/**
 * Marketing department item endpoint.
 *
 *   PUT    /api/marketing/<resource>/<id>  -> update
 *   DELETE /api/marketing/<resource>/<id>  -> delete
 */
import { NextRequest } from 'next/server';
import { departmentItemRoute } from '@/lib/department-api';

const handlers = departmentItemRoute('marketing');

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
