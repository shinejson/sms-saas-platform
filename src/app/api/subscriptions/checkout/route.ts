import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const PLAN_PRICES_GHS: Record<string, { amount: number; limit: number }> = {
  COPPER: { amount: 150.0, limit: 100 },
  SILVER: { amount: 300.0, limit: 250 },
  DIAMOND: { amount: 450.0, limit: 400 },
  GOLD: { amount: 600.0, limit: 600 },
  ENTERPRISE: { amount: 1200.0, limit: 2000 },
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'SCHOOL_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan } = await req.json();
    const planConfig = PLAN_PRICES_GHS[plan?.toUpperCase()];

    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Initialize Paystack transaction (Ghana Mobile Money & Cards)
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret || paystackSecret.startsWith('sk_test_replace')) {
      // Mock sandbox mode for testing before live API keys are provided
      const reference = 'PAY_' + Date.now();
      return NextResponse.json({
        success: true,
        reference,
        amount: planConfig.amount,
        currency: 'GHS',
        message: 'Paystack checkout initialized (Sandbox mode).',
        authorizationUrl: `https://checkout.paystack.com/mock/${reference}`,
      });
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: session.email,
        amount: Math.round(planConfig.amount * 100), // in Pesewas (kobo)
        currency: 'GHS',
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?payment=success`,
        metadata: {
          tenantId: tenant.id,
          plan: plan.toUpperCase(),
          studentLimit: planConfig.limit,
        },
      }),
    });

    const data = await paystackRes.json();
    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Payment initialization failed' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (error: any) {
    console.error('Subscription error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
