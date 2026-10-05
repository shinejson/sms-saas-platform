import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, sessionErrorResponse } from '@/lib/session-server';
import {
  SESSION_ABSOLUTE_HOURS,
  SESSION_IDLE_MINUTES,
  SESSION_WARNING_SECONDS,
} from '@/lib/session';

/**
 * GET /api/auth/session
 *
 * Source of truth for "am I still logged in?". Every protected page calls this
 * on mount before rendering: it re-verifies the JWT signature and expiry, and
 * re-checks that the user and school are still active. A token left in
 * localStorage months ago fails here, so the dashboard can no longer be opened
 * with a dead session.
 */
export async function GET(req: NextRequest) {
  try {
    const result = await authenticateRequest(req);

    if (!result.ok) {
      return sessionErrorResponse(result);
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: result.user,
        tenant: result.tenant,
        // Inactivity deadline currently baked into the token.
        expiresAt: result.expiresAt,
        // Hard cap for this login, whatever the user does.
        sessionExpiresAt: result.sessionExpiresAt,
        sessionStartedAt: (result.session.sst ?? result.session.iat ?? 0) * 1000,
        policy: {
          idleMinutes: SESSION_IDLE_MINUTES,
          absoluteHours: SESSION_ABSOLUTE_HOURS,
          warningSeconds: SESSION_WARNING_SECONDS,
        },
        serverTime: Date.now(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
