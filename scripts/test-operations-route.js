const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'sms-saas-production-jwt-secret-replace-me-random-64-chars';

async function main() {
  try {
    const user = await prisma.user.findFirst({
      include: { tenant: true },
    });

    if (!user) {
      console.log('No user found in database');
      return;
    }

    console.log('Testing with user:', user.email, 'Role:', user.role, 'Tenant:', user.tenant.name);

    // Create session token
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        subdomain: user.tenant.subdomain,
        jti: crypto.randomUUID(),
      },
      JWT_SECRET,
      { expiresIn: '8h', algorithm: 'HS512' }
    );

    console.log('Generated Token');

    // Test Prisma queries that department-api executes
    console.log('1. Checking isAllowed...');
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
      const record = await prisma.permission.findFirst({
        where: { tenantId: user.tenantId, role: user.role },
        select: { actions: true },
      });
      console.log('Permission record:', record);
    } else {
      console.log('User is admin, allowed automatically');
    }

    console.log('2. Checking prisma.asset.findMany...');
    const where = { tenantId: user.tenantId };
    const rows = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    console.log('Assets findMany returned:', rows.length, 'records');

  } catch (err) {
    console.error('CRASH in test-operations-route:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
