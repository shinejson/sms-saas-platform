import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { calculateSubscriptionStatus } from '@/lib/subscriptions';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'SCHOOL_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Admin privilege required.' }, { status: 401 });
    }

    const { action } = await req.json();

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    let targetDate: Date;
    let targetStatus = 'active';

    if (action === 'set_expiring') {
      // 3 days from now
      targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      targetStatus = 'active';
    } else if (action === 'set_expired') {
      // 1 day in the past
      targetDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      targetStatus = 'expired';
    } else if (action === 'set_active') {
      // 30 days from now
      targetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      targetStatus = 'active';
    } else {
      return NextResponse.json({ error: 'Invalid action. Choose set_expiring, set_expired, or set_active.' }, { status: 400 });
    }

    let subscription = tenant.subscriptions[0];
    if (subscription) {
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodEnd: targetDate,
          status: targetStatus,
        },
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: tenant.plan,
          studentLimit: tenant.studentLimit,
          amount: 0,
          currency: 'GHS',
          billingCycle: 'monthly',
          status: targetStatus,
          paymentGateway: 'test_simulation',
          currentPeriodStart: new Date(),
          currentPeriodEnd: targetDate,
        },
      });
    }

    // Ensure tenant status is ACTIVE if restored
    if (action === 'set_active') {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'ACTIVE' },
      });
    }

    const statusInfo = calculateSubscriptionStatus(subscription.currentPeriodEnd, action === 'set_active' ? 'ACTIVE' : tenant.status);

    return NextResponse.json({
      success: true,
      action,
      subscription,
      statusInfo,
      message: `Subscription simulated to: ${statusInfo.status.toUpperCase()} (${statusInfo.daysRemaining} days remaining).`,
    });
  } catch (error: any) {
    console.error('Simulate status error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
