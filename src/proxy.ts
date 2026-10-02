import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up expired entries
function cleanExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  cleanExpiredEntries();
  
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true };
  }
  
  if (now > entry.resetTime) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true };
  }
  
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.count++;
  return { allowed: true };
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;
  
  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Get IP address for rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
             req.headers.get('x-real-ip') || 
             'unknown';
  
  // === ORIGIN VALIDATION (CSRF Protection) ===
  // Apply to state-changing methods only
  const stateMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (stateMethods.includes(method)) {
    // Exempt auth routes (they ARE the entry point) and webhooks
    const exemptPaths = [
      '/api/auth/login',
      '/api/auth/register-school',
      '/api/subscriptions/webhook',
    ];
    
    const isExempt = exemptPaths.some(path => pathname.startsWith(path));
    
    if (!isExempt) {
      const origin = req.headers.get('origin');
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      
      const allowedOrigins = [
        appUrl,
        'http://localhost:3000',
        'http://localhost:3001',
      ].filter(Boolean);
      
      if (origin && !allowedOrigins.includes(origin)) {
        console.warn(`[Security] Origin validation failed: ${origin} for ${pathname}`);
        return NextResponse.json(
          { error: 'Invalid origin' },
          { status: 403 }
        );
      }
    }
  }
  
  // === RATE LIMITING ===
  let rateLimitConfig: { max: number; window: number } | null = null;
  
  // Auth endpoints: 10 requests per 15 min
  if (pathname.startsWith('/api/auth/')) {
    rateLimitConfig = { max: 10, window: 15 * 60 * 1000 };
  }
  // Webhook endpoints: 20 requests per hour
  else if (pathname.includes('/webhook')) {
    rateLimitConfig = { max: 20, window: 60 * 60 * 1000 };
  }
  // Write operations: 60 requests per minute
  else if (stateMethods.includes(method)) {
    rateLimitConfig = { max: 60, window: 60 * 1000 };
  }
  // Read operations: 200 requests per minute
  else if (method === 'GET') {
    rateLimitConfig = { max: 200, window: 60 * 1000 };
  }
  
  if (rateLimitConfig) {
    const rateLimitKey = `${pathname}:${ip}`;
    const rateLimit = checkRateLimit(rateLimitKey, rateLimitConfig.max, rateLimitConfig.window);
    
    if (!rateLimit.allowed) {
      console.warn(`[Security] Rate limit exceeded for ${ip} on ${pathname}`);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
          },
        }
      );
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
