const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- 1. Testing Asset findMany with where clause ---');
    const tenant = await prisma.tenant.findFirst();
    console.log('Using tenant:', tenant?.id, tenant?.name);
    if (!tenant) {
      console.log('No tenant found');
      return;
    }

    const where = { tenantId: tenant.id };
    const rows = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    console.log('Prisma Asset findMany successful! Rows returned:', rows.length);

    console.log('--- 2. Testing Permission query for user roles ---');
    const roles = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'BURSAR', 'TEACHER', 'VIEWER'];
    for (const role of roles) {
      const record = await prisma.permission.findFirst({
        where: { tenantId: tenant.id, role },
        select: { actions: true },
      });
      console.log(`Permission for ${role}:`, record ? record.actions.slice(0, 50) + '...' : 'NONE');
    }
  } catch (err) {
    console.error('ERROR in test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
