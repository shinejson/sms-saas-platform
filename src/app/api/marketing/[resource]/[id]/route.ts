/**
 * Marketing department item endpoint.
 *
 *   PUT    /api/marketing/<resource>/<id>  -> update
 *   DELETE /api/marketing/<resource>/<id>  -> delete
 */
import { departmentItemRoute } from '@/lib/department-api';

const handlers = departmentItemRoute('marketing');

export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
