import { NextRequest } from 'next/server';
import { prisma } from './prisma';

/**
 * Mirrors the GAS `safeLogAuditEvent` helper: audit writes must never break the
 * business operation that triggered them, so failures are logged and swallowed.
 */
export interface AuditEvent {
  tenantId: string;
  userId?: string | null;
  action: 'Create' | 'Update' | 'Delete' | string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        userId: event.userId ?? null,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId ?? null,
        details: event.details === undefined ? null : JSON.stringify(event.details),
        ipAddress: event.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}
