import { prisma } from './prisma';

export async function resolveTenantBySubdomain(subdomain: string) {
  if (!subdomain) return null;
  return prisma.tenant.findUnique({
    where: { subdomain: subdomain.toLowerCase().trim() },
    include: {
      subscriptions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function verifyTenantStudentQuota(tenantId: string): Promise<{
  canAdd: boolean;
  currentCount: number;
  limit: number;
  plan: string;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, studentLimit: true },
  });

  if (!tenant) throw new Error('School tenant not found');

  const currentCount = await prisma.student.count({
    where: { tenantId, status: 'ACTIVE' },
  });

  return {
    canAdd: currentCount < tenant.studentLimit,
    currentCount,
    limit: tenant.studentLimit,
    plan: tenant.plan,
  };
}
