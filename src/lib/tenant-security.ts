import { prisma } from './prisma';
import { TenantIsolationError } from './errors';

/**
 * Verifies that a record belongs to the specified tenant.
 * Throws TenantIsolationError if the record doesn't exist or doesn't belong to the tenant.
 * 
 * This is critical for multi-tenant security - prevents cross-tenant data access.
 * 
 * @param modelName - Prisma model name (e.g., 'invoice', 'student', 'payment')
 * @param recordId - The record ID to verify
 * @param tenantId - The tenant ID that should own the record
 * @param select - Optional select object to specify which fields to return
 * @returns The record if it exists and belongs to the tenant
 * @throws TenantIsolationError if record not found or doesn't belong to tenant
 */
export async function verifyTenantOwnership<T = any>(
  modelName: string,
  recordId: string,
  tenantId: string,
  select?: any
): Promise<T> {
  // Access the Prisma model dynamically
  const model = (prisma as any)[modelName];
  
  if (!model || typeof model.findFirst !== 'function') {
    throw new Error(`Invalid model name: ${modelName}`);
  }
  
  const record = await model.findFirst({
    where: {
      id: recordId,
      tenantId,
    },
    ...(select ? { select } : {}),
  });
  
  if (!record) {
    // Use a non-revealing error message that doesn't leak information
    // about whether the record exists or just doesn't belong to the tenant
    throw new TenantIsolationError('Record not found or access denied');
  }
  
  return record as T;
}

/**
 * Verifies that a related resource belongs to the tenant.
 * Useful for validating request body references (e.g., classId, academicYearId).
 * 
 * @param modelName - Prisma model name
 * @param recordId - The record ID to verify
 * @param tenantId - The tenant ID that should own the record
 * @returns true if record exists and belongs to tenant, false otherwise
 */
export async function verifyTenantResource(
  modelName: string,
  recordId: string | undefined | null,
  tenantId: string
): Promise<boolean> {
  if (!recordId) {
    return true; // Optional fields are allowed to be null/undefined
  }
  
  try {
    await verifyTenantOwnership(modelName, recordId, tenantId);
    return true;
  } catch {
    return false;
  }
}
