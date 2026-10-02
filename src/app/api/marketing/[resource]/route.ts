/**
 * Marketing department collection endpoint.
 *
 *   GET  /api/marketing/<resource>?q=&status=   -> list (tenant-scoped)
 *   POST /api/marketing/<resource>              -> create
 *
 * `<resource>` is validated against the registry in `src/lib/departments.ts`
 * (campaigns | leads | announcements | events | referrals).
 */
import { departmentCollectionRoute } from '@/lib/department-api';

const handlers = departmentCollectionRoute('marketing');

export const GET = handlers.GET;
export const POST = handlers.POST;
