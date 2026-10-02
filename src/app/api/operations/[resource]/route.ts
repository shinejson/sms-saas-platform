/**
 * Operations department collection endpoint.
 *
 *   GET  /api/operations/<resource>?q=&status=   -> list (tenant-scoped)
 *   POST /api/operations/<resource>              -> create
 *
 * `<resource>` is validated against the registry in `src/lib/departments.ts`
 * (assets | requisitions | work-orders | transport | vendors); anything else
 * returns 404.
 */
import { NextRequest } from 'next/server';
import { departmentCollectionRoute } from '@/lib/department-api';

const handlers = departmentCollectionRoute('operations');

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
