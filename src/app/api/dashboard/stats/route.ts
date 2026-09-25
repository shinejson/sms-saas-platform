import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized. Missing token.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      include: {
        academicYears: {
          where: { status: 'Active' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    const [studentCount, classCount, subjectCount, staffCount, billingCategoryCount] = await Promise.all([
      prisma.student.count({ where: { tenantId: session.tenantId, status: 'ACTIVE' } }),
      prisma.class.count({ where: { tenantId: session.tenantId } }),
      prisma.subject.count({ where: { tenantId: session.tenantId } }),
      prisma.user.count({ where: { tenantId: session.tenantId, status: 'ACTIVE' } }),
      prisma.billingCategory.count({ where: { tenantId: session.tenantId } }),
    ]);

    const activeYear = tenant.academicYears[0] || null;

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        alias: tenant.alias,
        subdomain: tenant.subdomain,
        currency: tenant.currency,
        plan: tenant.plan,
        studentLimit: tenant.studentLimit,
      },
      stats: {
        studentCount,
        studentLimit: tenant.studentLimit,
        quotaPercentage: tenant.studentLimit > 0 ? Math.round((studentCount / tenant.studentLimit) * 100) : 0,
        classCount,
        subjectCount,
        staffCount,
        billingCategoryCount,
        activeYear: activeYear ? activeYear.year : '2026/2027',
        currentTerm: activeYear ? activeYear.currentTerm : 'Term 1',
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
