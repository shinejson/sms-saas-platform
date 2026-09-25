import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const PLAN_PRICES_GHS: Record<string, number> = {
  DEMO: 0,
  COPPER: 150,
  SILVER: 300,
  DIAMOND: 450,
  GOLD: 600,
  ENTERPRISE: 1200,
};

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized. Missing token.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Super Admin access required.' }, { status: 403 });
    }

    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalStudents,
      totalUsers,
      planGroups,
      recentTenants,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      prisma.student.count(),
      prisma.user.count(),
      prisma.tenant.groupBy({
        by: ['plan'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      }),
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          subdomain: true,
          plan: true,
          status: true,
          studentLimit: true,
          createdAt: true,
          _count: {
            select: {
              students: true,
              users: true,
            },
          },
        },
      }),
    ]);

    // Calculate estimated MRR
    let estimatedMRR = 0;
    const planDistribution: Record<string, number> = {
      DEMO: 0,
      COPPER: 0,
      SILVER: 0,
      DIAMOND: 0,
      GOLD: 0,
      ENTERPRISE: 0,
    };

    planGroups.forEach((item) => {
      const planName = item.plan;
      const count = item._count.id;
      planDistribution[planName] = count;
      const price = PLAN_PRICES_GHS[planName] || 0;
      estimatedMRR += price * count;
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalTenants,
        activeTenants,
        suspendedTenants,
        totalStudents,
        totalUsers,
        estimatedMRR,
        planDistribution,
        recentTenants,
      },
    });
  } catch (error: any) {
    console.error('Super Admin Stats error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
