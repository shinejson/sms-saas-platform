import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  verifyGatewayPayment,
  GatewayType,
} from '@/lib/payment-gateways';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired.' }, { status: 401 });
    }

    const {
      reference,
      gateway = 'paystack',
      plan: fallbackPlanKey = 'SILVER',
      billingCycle = 'monthly',
    } = await req.json();

    if (!reference) {
      return NextResponse.json({ error: 'Missing payment transaction reference.' }, { status: 400 });
    }

    const result = await verifyGatewayPayment({
      gateway: gateway as GatewayType,
      reference,
      tenantId: session.tenantId,
      fallbackPlan: fallbackPlanKey,
      fallbackBillingCycle: billingCycle,
    });

    return NextResponse.json({
      success: true,
      message: `Online payment verified! Successfully auto-upgraded to ${result.tenant.plan} Plan.`,
      tenant: result.tenant,
      subscription: result.subscription,
    });
  } catch (error: any) {
    console.error('Verify subscription error:', error);
    return NextResponse.json({ error: error.message || 'Payment verification failed' }, { status: 400 });
  }
}
