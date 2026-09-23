import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    // Verify Paystack payment success event
    if (event.event === 'charge.success') {
      const metadata = event.data.metadata;
      const tenantId = metadata?.tenantId;
      const plan = metadata?.plan;
      const studentLimit = Number(metadata?.studentLimit) || 100;

      if (tenantId && plan) {
        await prisma.$transaction([
          prisma.tenant.update({
            where: { id: tenantId },
            data: {
              plan: plan as any,
              studentLimit,
              status: 'ACTIVE',
            },
          }),
          prisma.subscription.create({
            data: {
              tenantId,
              plan: plan as any,
              studentLimit,
              amount: event.data.amount / 100,
              currency: event.data.currency || 'GHS',
              billingCycle: 'monthly',
              status: 'active',
              paymentGateway: 'paystack',
              gatewayReference: event.data.reference,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          }),
        ]);
        console.log(`Successfully activated ${plan} plan for tenant ${tenantId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
