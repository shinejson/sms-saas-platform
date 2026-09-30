import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  SUBSCRIPTION_PLANS,
  getPlanPrice,
} from '@/lib/subscriptions';
import {
  initializeGatewayPayment,
  GatewayType,
  getTenantPaymentGateways,
} from '@/lib/payment-gateways';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'SCHOOL_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Administrator privilege required.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      plan: selectedPlanKey,
      billingCycle = 'monthly',
      gateway: requestedGateway,
      simulate = false,
    } = body;

    const planKey = (selectedPlanKey || '').toUpperCase();
    const planConfig = SUBSCRIPTION_PLANS[planKey];

    if (!planConfig || planKey === 'DEMO') {
      return NextResponse.json({ error: 'Invalid or unsupported subscription tier selected.' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant school record not found.' }, { status: 404 });
    }

    // Determine gateway: requested or default
    const configs = await getTenantPaymentGateways(session.tenantId);
    const gateway: GatewayType = (requestedGateway || configs.defaultGateway || 'paystack') as GatewayType;

    const amount = getPlanPrice(planKey, billingCycle);
    const currency = configs.currency || tenant.currency || 'GHS';

    const result = await initializeGatewayPayment({
      gateway,
      amount,
      currency,
      email: session.email,
      tenantId: tenant.id,
      plan: planKey,
      studentLimit: planConfig.studentLimit,
      billingCycle,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?tab=subscription&payment=success&plan=${planKey}&cycle=${billingCycle}`,
      simulate,
    });

    return NextResponse.json({
      ...result,
      plan: planKey,
      studentLimit: planConfig.studentLimit,
      billingCycle,
    });
  } catch (error: any) {
    console.error('Subscription checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
