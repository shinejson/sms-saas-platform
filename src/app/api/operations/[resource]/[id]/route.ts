/**
 * Operations department item endpoint.
 *
 *   PUT    /api/operations/<resource>/<id>  -> update
 *   DELETE /api/operations/<resource>/<id>  -> delete
 */
import { departmentItemRoute } from '@/lib/department-api';

const handlers = departmentItemRoute('operations');

export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
