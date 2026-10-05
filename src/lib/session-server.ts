import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import {
  getBearerToken,
  isSessionBeyondAbsoluteLimit,
  sessionAbsoluteDeadlineMs,
  verifyToken,
  type UserSessionPayload,
} from './auth';
import { decodeTokenClaims, type LogoutReason } from './session';

/**
 * Server-side session validation shared by the session endpoints.
 *
 * A signed JWT alone is not enough to keep someone logged in: the account may
 * have been suspended/deleted, the school tenant may have been suspended, or
 * the session may have outlived the absolute cap. Everything is re-checked
 * here so a stale browser token can never reopen the dashboard.
 */

export interface AuthenticatedSession {
  ok: true;
  token: string;
  session: UserSessionPayload;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
  };
  tenant: {
    id: string;
    name: string;
    alias: string;
    subdomain: string;
    plan: string;
    currency: string;
    status: string;
    logoUrl: string | null;
  } | null;
  /** Token (inactivity) expiry in ms. */
  expiresAt: number;
  /** Absolute session deadline in ms. */
  sessionExpiresAt: number;
}

export interface FailedSession {
  ok: false;
  status: number;
  reason: LogoutReason;
  error: string;
}

export type SessionResult = AuthenticatedSession | FailedSession;

function fail(status: number, reason: LogoutReason, error: string): FailedSession {
  return { ok: false, status, reason, error };
}

/**
 * Validates the bearer token on a request:
 *  signature + expiry (inactivity window) -> absolute cap -> account status.
 *
 * `allowExpired` is used by the logout endpoint, which still wants to know who
 * is signing out even when the token has just died.
 */
export async function authenticateRequest(
  req: NextRequest,
  options: { allowExpired?: boolean } = {}
): Promise<SessionResult> {
  const token = getBearerToken(req);
  if (!token) {
    return fail(401, 'invalid', 'Authentication required.');
  }

  let session = verifyToken(token);

  if (!session && options.allowExpired) {
    // Expired-but-authentic tokens are still useful for audit logging.
    const claims = decodeTokenClaims(token);
    if (claims?.userId && claims?.tenantId) {
      session = claims as UserSessionPayload;
    }
  }

  if (!session?.userId) {
    return fail(401, 'expired', 'Your session has expired. Please sign in again.');
  }

  if (!options.allowExpired && isSessionBeyondAbsoluteLimit(session)) {
    return fail(401, 'expired', 'Maximum session length reached. Please sign in again.');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
          alias: true,
          subdomain: true,
          plan: true,
          currency: true,
          status: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!user) {
    return fail(401, 'invalid', 'This account no longer exists. Please sign in again.');
  }

  if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
    return fail(403, 'suspended', 'Your account has been suspended or deactivated. Contact your administrator.');
  }

  // Super admins may legitimately operate inside another tenant (impersonation).
  if (user.tenant?.status === 'SUSPENDED' && session.role !== 'SUPER_ADMIN') {
    return fail(403, 'suspended', 'This school account is suspended. Contact the platform administrator.');
  }

  return {
    ok: true,
    token,
    session,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    },
    tenant: user.tenant
      ? {
          id: user.tenant.id,
          name: user.tenant.name,
          alias: user.tenant.alias,
          subdomain: user.tenant.subdomain,
          plan: user.tenant.plan,
          currency: user.tenant.currency,
          status: user.tenant.status,
          logoUrl: user.tenant.logoUrl,
        }
      : null,
    expiresAt: typeof session.exp === 'number' ? session.exp * 1000 : Date.now(),
    sessionExpiresAt: sessionAbsoluteDeadlineMs(session),
  };
}

/** Standard 401/403 body understood by the browser session guard. */
export function sessionErrorResponse(result: FailedSession) {
  return NextResponse.json(
    { error: result.error, reason: result.reason, authenticated: false },
    { status: result.status }
  );
}
