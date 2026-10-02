/**
 * Marketing department collection endpoint.
 *
 *   GET  /api/marketing/<resource>?q=&status=   -> list (tenant-scoped)
 *   POST /api/marketing/<resource>              -> create
 *
 * `<resource>` is validated against the registry in `src/lib/departments.ts`
 * (campaigns | leads | announcements | events | referrals).
 */
import { NextRequest } from 'next/server';
import { departmentCollectionRoute } from '@/lib/department-api';

const handlers = departmentCollectionRoute('marketing');

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> }
) {
  return handlers.GET(req, ctx);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> }
) {
  return handlers.POST(req, ctx);
}
