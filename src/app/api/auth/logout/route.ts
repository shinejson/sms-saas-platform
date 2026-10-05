import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, logAuditEvent } from '@/lib/audit';
import { authenticateRequest } from '@/lib/session-server';
import { isLogoutReason } from '@/lib/session';

/**
 * POST /api/auth/logout
 *
 * The JWT is stateless, so the browser clearing storage is what actually ends
 * the session. This endpoint records *why* it ended (manual sign-out,
 * inactivity timeout, expiry) in the audit trail, which is what makes idle
 * logouts auditable.
 */
export async function POST(req: NextRequest) {
  try {
    let reason = 'manual';
    try {
      const body = await req.json();
      if (typeof body?.reason === 'string' && isLogoutReason(body.reason)) {
        reason = body.reason;
      }
    } catch {
      /* body is optional */
    }

    // Accept expired tokens: a session that timed out still deserves a log line.
    const result = await authenticateRequest(req, { allowExpired: true });

    if (result.ok) {
      await logAuditEvent({
        tenantId: result.session.tenantId,
        userId: result.user.id,
        action: 'Logout',
        entity: 'Session',
        entityId: result.session.jti ?? null,
        details: {
          reason,
          email: result.user.email,
          role: result.user.role,
          lastActivityAt: new Date().toISOString(),
        },
        ipAddress: getClientIp(req),
      });
    }

    // Always succeed - the client must be able to sign out no matter what.
    return NextResponse.json(
      { success: true, reason },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
