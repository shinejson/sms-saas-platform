import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';
import { getClientIp, logAuditEvent } from '@/lib/audit';
import {
  SESSION_ABSOLUTE_HOURS,
  SESSION_IDLE_MINUTES,
  SESSION_TOKEN_TTL_SECONDS,
} from '@/lib/session';

// In-memory rate limiting for login attempts
interface RateLimitEntry {
  attempts: number;
  resetTime: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
function cleanExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of loginAttempts.entries()) {
    if (now > entry.resetTime) {
      loginAttempts.delete(key);
    }
  }
}

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  cleanExpiredEntries();
  
  const now = Date.now();
  const entry = loginAttempts.get(key);
  
  if (!entry) {
    return { allowed: true };
  }
  
  if (now > entry.resetTime) {
    loginAttempts.delete(key);
    return { allowed: true };
  }
  
  if (entry.attempts >= 5) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  
  if (!entry || now > entry.resetTime) {
    loginAttempts.set(key, {
      attempts: 1,
      resetTime: now + 15 * 60 * 1000, // 15 minutes
    });
  } else {
    entry.attempts++;
  }
}

function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, subdomain } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Rate limiting key: email + IP address
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `login:${cleanEmail}:${ip}`;
    
    // Check rate limit
    const rateLimit = checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      console.warn(`[Security] Rate limit exceeded for ${cleanEmail} from ${ip}`);
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.` },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
          },
        }
      );
    }

    // Single query: look up user (+ tenant) scoped to subdomain when provided,
    // falling back to a global email search so Super Admin can always log in.
    const user = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        ...(subdomain
          ? { tenant: { subdomain: subdomain.toLowerCase().trim() } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tenantId: true,
        passwordHash: true,
        status: true,
        tenant: {
          select: {
            id: true,
            name: true,
            alias: true,
            subdomain: true,
            plan: true,
            currency: true,
          },
        },
      },
    });

    if (!user) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      return NextResponse.json(
        { error: 'Your account has been suspended or deactivated. Contact your administrator.' },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful login - clear rate limit
    clearRateLimit(rateLimitKey);

    // The token lifetime equals the inactivity window and is slid forward by
    // /api/auth/refresh while the user is active (see src/lib/session.ts).
    const token = generateToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      subdomain: user.tenant.subdomain,
    });

    // Audit trail: logins and logouts are both recorded so a session can be
    // followed end to end.
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'Login',
      entity: 'Session',
      details: { email: user.email, role: user.role },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      tenant: user.tenant,
      token,
      // Session policy, so the client can show accurate timeout messaging.
      expiresAt: Date.now() + SESSION_TOKEN_TTL_SECONDS * 1000,
      sessionPolicy: {
        idleMinutes: SESSION_IDLE_MINUTES,
        absoluteHours: SESSION_ABSOLUTE_HOURS,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
