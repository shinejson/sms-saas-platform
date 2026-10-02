/**
 * Operations department item endpoint.
 *
 *   PUT    /api/operations/<resource>/<id>  -> update
 *   DELETE /api/operations/<resource>/<id>  -> delete
 */
import { NextRequest } from 'next/server';
import { departmentItemRoute } from '@/lib/department-api';

const handlers = departmentItemRoute('operations');

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  return handlers.PUT(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  return handlers.DELETE(req, ctx);
}
