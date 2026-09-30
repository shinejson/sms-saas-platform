import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  calculateSubscriptionStatus,
  SUBSCRIPTION_PLANS,
} from '@/lib/subscriptions';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired or invalid.' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { students: true },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    let subscriptions = tenant.subscriptions;
    let latestSub = subscriptions.length > 0 ? subscriptions[0] : null;

    // If no subscription record exists yet, create an initial trial record based on tenant creation
    if (!latestSub) {
      const trialDurationDays = 14;
      const trialEnd = new Date(new Date(tenant.createdAt).getTime() + trialDurationDays * 24 * 60 * 60 * 1000);
      try {
        latestSub = await prisma.subscription.create({
          data: {
            tenantId: tenant.id,
            plan: tenant.plan || 'DEMO',
            studentLimit: tenant.studentLimit || 15,
            amount: 0,
            currency: tenant.currency || 'GHS',
            billingCycle: 'trial',
            status: trialEnd.getTime() > Date.now() ? 'active' : 'expired',
            paymentGateway: 'free_trial',
            currentPeriodStart: tenant.createdAt,
            currentPeriodEnd: trialEnd,
          },
        });
        subscriptions = [latestSub];
      } catch (err) {
        console.error('Error auto-seeding initial trial subscription:', err);
      }
    }

    const currentPeriodEnd = latestSub ? latestSub.currentPeriodEnd : new Date(tenant.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const statusInfo = calculateSubscriptionStatus(currentPeriodEnd, tenant.status);

    const studentCount = tenant._count?.students || 0;
    const studentLimit = tenant.studentLimit || 15;
    const quotaPercentage = studentLimit > 0 ? Math.min(100, Math.round((studentCount / studentLimit) * 100)) : 0;

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        alias: tenant.alias,
        subdomain: tenant.subdomain,
        currency: tenant.currency || 'GHS',
        plan: tenant.plan,
        studentLimit: tenant.studentLimit,
        status: tenant.status,
      },
      currentSubscription: latestSub
        ? {
            id: latestSub.id,
            plan: latestSub.plan,
            studentLimit: latestSub.studentLimit,
            amount: Number(latestSub.amount),
            currency: latestSub.currency,
            billingCycle: latestSub.billingCycle,
            status: latestSub.status,
            paymentGateway: latestSub.paymentGateway,
            gatewayReference: latestSub.gatewayReference,
            currentPeriodStart: latestSub.currentPeriodStart,
            currentPeriodEnd: latestSub.currentPeriodEnd,
            createdAt: latestSub.createdAt,
          }
        : null,
      statusInfo,
      usage: {
        studentCount,
        studentLimit,
        quotaPercentage,
        remainingSlots: Math.max(0, studentLimit - studentCount),
      },
      plans: Object.values(SUBSCRIPTION_PLANS),
      history: subscriptions.map((s) => ({
        id: s.id,
        plan: s.plan,
        studentLimit: s.studentLimit,
        amount: Number(s.amount),
        currency: s.currency,
        billingCycle: s.billingCycle,
        status: s.status,
        paymentGateway: s.paymentGateway,
        gatewayReference: s.gatewayReference,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        createdAt: s.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
