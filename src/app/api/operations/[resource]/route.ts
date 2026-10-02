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
import { departmentCollectionRoute } from '@/lib/department-api';

const handlers = departmentCollectionRoute('operations');

export const GET = handlers.GET;
export const POST = handlers.POST;
