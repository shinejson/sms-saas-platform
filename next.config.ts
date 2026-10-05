import type { NextConfig } from "next";

// Clickjacking protection stays strict in production. In local development the
// app is often opened through a tunnelled preview that renders it in an
// iframe, which `DENY` / `frame-ancestors 'none'` would block outright.
const isDev = process.env.NODE_ENV !== 'production';
const frameAncestors = isDev ? "frame-ancestors *" : "frame-ancestors 'none'";

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default.
  // Empty turbopack config silences the webpack/turbopack mismatch warning.
  // Turbopack handles node built-ins (fs, net, tls) automatically.
  turbopack: {},
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Only sent in production: the modern equivalent is the CSP
          // `frame-ancestors` directive below, which dev relaxes for previews.
          ...(isDev
            ? []
            : [
                {
                  key: 'X-Frame-Options',
                  value: 'DENY',
                },
              ]),
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.paystack.co https://api.flutterwave.com https://api.stripe.com; ${frameAncestors}; base-uri 'self'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
