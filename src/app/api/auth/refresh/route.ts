import { NextRequest, NextResponse } from 'next/server';
import { rotateSessionToken } from '@/lib/auth';
import { authenticateRequest, sessionErrorResponse } from '@/lib/session-server';
import { SESSION_ABSOLUTE_HOURS, SESSION_IDLE_MINUTES } from '@/lib/session';

/**
 * POST /api/auth/refresh
 *
 * Slides the inactivity window forward for a user who is genuinely active.
 * Access tokens are minted with a lifetime equal to the idle timeout, so this
 * endpoint is what keeps a working user signed in - and what stops an
 * abandoned tab from staying authenticated.
 *
 * Refusals:
 *  - token already expired / invalid        -> 401 (sign in again)
 *  - account or school suspended            -> 403
 *  - session older than the absolute cap    -> 401 (sign in again)
 */
export async function POST(req: NextRequest) {
  try {
    const result = await authenticateRequest(req);

    if (!result.ok) {
      return sessionErrorResponse(result);
    }

    const rotated = rotateSessionToken(result.session, {
      // Keep role/name in sync with the database on every refresh.
      email: result.user.email,
      fullName: result.session.fullName,
      role: result.user.role,
    });

    if (!rotated) {
      return NextResponse.json(
        {
          error: `Maximum session length of ${SESSION_ABSOLUTE_HOURS} hours reached. Please sign in again.`,
          reason: 'expired',
          authenticated: false,
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        token: rotated.token,
        expiresAt: rotated.expiresAt,
        sessionExpiresAt: rotated.sessionExpiresAt,
        user: result.user,
        tenant: result.tenant,
        policy: {
          idleMinutes: SESSION_IDLE_MINUTES,
          absoluteHours: SESSION_ABSOLUTE_HOURS,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Session refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
