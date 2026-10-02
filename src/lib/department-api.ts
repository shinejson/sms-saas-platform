/**
 * Generic, tenant-safe CRUD engine for the department registry.
 *
 * `src/lib/departments.ts` describes every Operations / Marketing resource
 * declaratively; this module turns that description into Next.js route
 * handlers so the ten pages share one audited, permission-checked code path
 * instead of twenty hand-written copies.
 *
 * Guarantees for every request:
 *   1. a valid JWT session                      -> 401
 *   2. the role's permission policy allows it   -> 403
 *   3. every query is filtered by `tenantId`    -> no cross-tenant reads/writes
 *   4. writes are recorded in the audit log
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { verifyToken, type UserSessionPayload } from './auth';
import { getClientIp, logAuditEvent } from './audit';
import { sanitizeError } from './errors';
import { parsePermPolicy, type PermAction } from './permissions';
import {
  getDepartmentResource,
  type DepartmentFieldDef,
  type DepartmentKey,
  type DepartmentResourceDef,
} from './departments';

const MAX_ROWS = 500;
const isDev = process.env.NODE_ENV !== 'production';

type PrismaDelegate = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
  delete: (args: unknown) => Promise<Record<string, unknown>>;
  count: (args?: unknown) => Promise<number>;
};

function delegate(resource: DepartmentResourceDef): PrismaDelegate {
  let model = (prisma as unknown as Record<string, PrismaDelegate>)[resource.model];
  if (!model || typeof model.findMany !== 'function') {
    try {
      // In dev mode, PrismaClient in globalThis may be stale if schema was regenerated after server boot
      const { PrismaClient } = require('@prisma/client');
      const freshClient = new PrismaClient({
        datasourceUrl: process.env.DATABASE_URL,
        errorFormat: 'minimal',
      });
      const freshModel = (freshClient as unknown as Record<string, PrismaDelegate>)[resource.model];
      if (freshModel && typeof freshModel.findMany === 'function') {
        (globalThis as unknown as { prisma: unknown }).prisma = freshClient;
        return freshModel;
      }
    } catch {
      // Fall through to error
    }
    throw new Error(`Unknown Prisma model for resource "${resource.key}": ${resource.model}`);
  }
  return model;
}

/* -------------------------------------------------------------------------- */
/* Auth + RBAC                                                                 */
/* -------------------------------------------------------------------------- */

function readSession(req: NextRequest): UserSessionPayload | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7).trim());
}

/**
 * Server-side mirror of the dashboard's `can()` helper. The sidebar hides
 * pages a role may not see; this makes sure the API agrees — hiding a button
 * is not access control.
 */
async function isAllowed(session: UserSessionPayload, permKey: string, action: PermAction): Promise<boolean> {
  if (session.role === 'SUPER_ADMIN' || session.role === 'SCHOOL_ADMIN') return true;

  const record = await prisma.permission.findFirst({
    where: { tenantId: session.tenantId, role: session.role },
    select: { actions: true },
  });

  // No policy configured for this role -> fall back to full access, exactly
  // like the dashboard does, so existing schools are not locked out.
  if (!record) return true;

  const policy = parsePermPolicy(record.actions);
  if (!policy) return true;

  const allowed = policy[permKey];
  return Array.isArray(allowed) && allowed.includes(action);
}

/* -------------------------------------------------------------------------- */
/* Value coercion & validation                                                 */
/* -------------------------------------------------------------------------- */

function emptyish(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

interface CoerceResult {
  value?: unknown;
  error?: string;
  skip?: boolean;
}

function coerceField(field: DepartmentFieldDef, raw: unknown, isCreate: boolean): CoerceResult {
  if (emptyish(raw)) {
    if (field.required) {
      // On update we only validate fields the client actually sent.
      if (isCreate || raw !== undefined) return { error: `${field.label} is required.` };
      return { skip: true };
    }
    if (raw === undefined && !isCreate) return { skip: true };

    switch (field.type) {
      case 'number':
        return { value: Number(field.defaultValue ?? 0) };
      case 'money':
        return { value: Number(field.defaultValue ?? 0) };
      case 'select':
        return { value: field.defaultValue !== undefined ? String(field.defaultValue) : null };
      case 'date':
        return { value: null };
      default:
        return { value: null };
    }
  }

  switch (field.type) {
    case 'number': {
      const num = Number(raw);
      if (!Number.isFinite(num) || !Number.isInteger(num)) {
        return { error: `${field.label} must be a whole number.` };
      }
      const min = field.min ?? 0;
      const max = field.max ?? 1_000_000;
      if (num < min || num > max) {
        return { error: `${field.label} must be between ${min} and ${max}.` };
      }
      return { value: num };
    }
    case 'money': {
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        return { error: `${field.label} must be a positive amount.` };
      }
      if (num > 1_000_000_000) {
        return { error: `${field.label} is unrealistically large.` };
      }
      return { value: Math.round(num * 100) / 100 };
    }
    case 'date': {
      const date = new Date(String(raw));
      if (Number.isNaN(date.getTime())) {
        return { error: `${field.label} is not a valid date.` };
      }
      return { value: date };
    }
    case 'select': {
      const value = String(raw).trim();
      if (field.options && !field.options.includes(value)) {
        return { error: `${field.label} must be one of: ${field.options.join(', ')}.` };
      }
      return { value };
    }
    case 'email': {
      const value = String(raw).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { error: `${field.label} is not a valid email address.` };
      }
      return { value: value.toLowerCase() };
    }
    case 'textarea': {
      const value = String(raw).trim();
      if (value.length > 5000) return { error: `${field.label} is too long (max 5000 characters).` };
      return { value };
    }
    default: {
      const value = String(raw).trim();
      if (value.length > 255) return { error: `${field.label} is too long (max 255 characters).` };
      return { value };
    }
  }
}

function buildData(
  resource: DepartmentResourceDef,
  body: Record<string, unknown>,
  isCreate: boolean
): { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {};

  for (const field of resource.fields) {
    if (field.generated) continue; // codes are owned by the server
    const result = coerceField(field, body[field.key], isCreate);
    if (result.error) return { error: result.error };
    if (result.skip) continue;
    data[field.key] = result.value;
  }

  if (!isCreate && Object.keys(data).length === 0) {
    return { error: 'Nothing to update.' };
  }
  return { data };
}

/* -------------------------------------------------------------------------- */
/* Human readable codes (AST-1001, WO-1002 ...)                                */
/* -------------------------------------------------------------------------- */

async function nextCode(resource: DepartmentResourceDef, tenantId: string): Promise<string | null> {
  if (!resource.codeField || !resource.codePrefix) return null;

  const rows = await delegate(resource).findMany({
    where: { tenantId },
    select: { [resource.codeField]: true },
  });

  const prefix = `${resource.codePrefix}-`;
  let max = 1000;
  for (const row of rows) {
    const code = String(row[resource.codeField] ?? '');
    if (!code.startsWith(prefix)) continue;
    const num = parseInt(code.slice(prefix.length), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return `${prefix}${max + 1}`;
}

/* -------------------------------------------------------------------------- */
/* Serialization (Prisma Decimal -> number, Date -> ISO)                       */
/* -------------------------------------------------------------------------- */

function serialize(resource: DepartmentResourceDef, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  for (const field of resource.fields) {
    const value = row[field.key];
    if (value === null || value === undefined) {
      out[field.key] = null;
      continue;
    }
    switch (field.type) {
      case 'money':
        out[field.key] = Number(value);
        break;
      case 'number':
        out[field.key] = Number(value);
        break;
      case 'date':
        out[field.key] = value instanceof Date ? value.toISOString() : value;
        break;
      default:
        out[field.key] = value;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Shared request plumbing                                                     */
/* -------------------------------------------------------------------------- */

interface ResolvedContext {
  session: UserSessionPayload;
  resource: DepartmentResourceDef;
}

async function resolve(
  req: NextRequest,
  department: DepartmentKey,
  resourceKey: string,
  action: PermAction
): Promise<ResolvedContext | NextResponse> {
  const resource = getDepartmentResource(department, resourceKey);
  if (!resource) {
    return NextResponse.json({ error: 'Unknown department resource' }, { status: 404 });
  }

  const session = readSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
  }

  if (!(await isAllowed(session, resource.permKey, action))) {
    return NextResponse.json(
      { error: `Your role does not have permission to ${action} ${resource.title}.` },
      { status: 403 }
    );
  }

  return { session, resource };
}

function fail(error: unknown) {
  const { error: message, statusCode } = sanitizeError(error, isDev);
  return NextResponse.json({ error: message }, { status: statusCode });
}

/* -------------------------------------------------------------------------- */
/* Collection handlers: /api/<department>/<resource>                           */
/* -------------------------------------------------------------------------- */

type CollectionContext = { params: Promise<{ resource: string }> };
type ItemContext = { params: Promise<{ resource: string; id: string }> };

export function departmentCollectionRoute(department: DepartmentKey) {
  return {
    async GET(req: NextRequest, ctx: CollectionContext) {
      try {
        const { resource: resourceKey } = await ctx.params;
        const resolved = await resolve(req, department, resourceKey, 'view');
        if (resolved instanceof NextResponse) return resolved;
        const { session, resource } = resolved;

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get('q') || '').trim();
        const status = (searchParams.get('status') || '').trim();

        const where: Record<string, unknown> = { tenantId: session.tenantId };

        if (status && resource.statusField) {
          where[resource.statusField] = status;
        }

        if (q) {
          const searchable = resource.fields.filter((f) => f.searchable);
          if (searchable.length > 0) {
            where.OR = searchable.map((f) => ({
              [f.key]: { contains: q, mode: 'insensitive' },
            }));
          }
        }

        const rows = await delegate(resource).findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: MAX_ROWS,
        });

        return NextResponse.json({
          success: true,
          resource: resource.key,
          count: rows.length,
          records: rows.map((row) => serialize(resource, row)),
        });
      } catch (error) {
        return fail(error);
      }
    },

    async POST(req: NextRequest, ctx: CollectionContext) {
      try {
        const { resource: resourceKey } = await ctx.params;
        const resolved = await resolve(req, department, resourceKey, 'create');
        if (resolved instanceof NextResponse) return resolved;
        const { session, resource } = resolved;

        const body = (await req.json()) as Record<string, unknown>;
        const built = buildData(resource, body, true);
        if ('error' in built) {
          return NextResponse.json({ error: built.error }, { status: 400 });
        }

        const data: Record<string, unknown> = { ...built.data, tenantId: session.tenantId };

        // Retry on the (very unlikely) race where two users grab the same code.
        let created: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 3 && !created; attempt++) {
          if (resource.codeField) {
            data[resource.codeField] = await nextCode(resource, session.tenantId);
          }
          try {
            created = await delegate(resource).create({ data });
          } catch (err) {
            const code = (err as { code?: string })?.code;
            if (code !== 'P2002' || attempt === 2) throw err;
          }
        }

        await logAuditEvent({
          tenantId: session.tenantId,
          userId: session.userId,
          action: 'Create',
          entity: resource.model,
          entityId: String(created!.id),
          details: { resource: resource.key, code: resource.codeField ? created![resource.codeField] : undefined },
          ipAddress: getClientIp(req),
        });

        return NextResponse.json({
          success: true,
          message: `${resource.singular} created successfully`,
          record: serialize(resource, created!),
        });
      } catch (error) {
        return fail(error);
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Item handlers: /api/<department>/<resource>/<id>                            */
/* -------------------------------------------------------------------------- */

export function departmentItemRoute(department: DepartmentKey) {
  return {
    async PUT(req: NextRequest, ctx: ItemContext) {
      try {
        const { resource: resourceKey, id } = await ctx.params;
        const resolved = await resolve(req, department, resourceKey, 'edit');
        if (resolved instanceof NextResponse) return resolved;
        const { session, resource } = resolved;

        const existing = await delegate(resource).findFirst({
          where: { id, tenantId: session.tenantId },
          select: { id: true },
        });
        if (!existing) {
          return NextResponse.json({ error: 'Record not found or access denied' }, { status: 404 });
        }

        const body = (await req.json()) as Record<string, unknown>;
        const built = buildData(resource, body, false);
        if ('error' in built) {
          return NextResponse.json({ error: built.error }, { status: 400 });
        }

        const updated = await delegate(resource).update({
          where: { id },
          data: built.data,
        });

        await logAuditEvent({
          tenantId: session.tenantId,
          userId: session.userId,
          action: 'Update',
          entity: resource.model,
          entityId: id,
          details: { resource: resource.key, fields: Object.keys(built.data) },
          ipAddress: getClientIp(req),
        });

        return NextResponse.json({
          success: true,
          message: `${resource.singular} updated successfully`,
          record: serialize(resource, updated),
        });
      } catch (error) {
        return fail(error);
      }
    },

    async DELETE(req: NextRequest, ctx: ItemContext) {
      try {
        const { resource: resourceKey, id } = await ctx.params;
        const resolved = await resolve(req, department, resourceKey, 'delete');
        if (resolved instanceof NextResponse) return resolved;
        const { session, resource } = resolved;

        const existing = await delegate(resource).findFirst({
          where: { id, tenantId: session.tenantId },
          select: { id: true },
        });
        if (!existing) {
          return NextResponse.json({ error: 'Record not found or access denied' }, { status: 404 });
        }

        await delegate(resource).delete({ where: { id } });

        await logAuditEvent({
          tenantId: session.tenantId,
          userId: session.userId,
          action: 'Delete',
          entity: resource.model,
          entityId: id,
          details: { resource: resource.key },
          ipAddress: getClientIp(req),
        });

        return NextResponse.json({ success: true, message: `${resource.singular} deleted` });
      } catch (error) {
        return fail(error);
      }
    },
  };
}
