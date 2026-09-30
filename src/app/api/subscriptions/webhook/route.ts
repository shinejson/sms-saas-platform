import { NextRequest, NextResponse } from 'next/server';
import { executeAutoUpgrade } from '@/lib/payment-gateways';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // 1. Paystack Webhook Event
    if (event?.event === 'charge.success') {
      const data = event.data || {};
      const metadata = data.metadata || {};
      const tenantId = metadata.tenantId;
      const plan = metadata.plan;
      const billingCycle = metadata.billingCycle || 'monthly';
      const studentLimit = Number(metadata.studentLimit) || undefined;
      const amount = (data.amount || 0) / 100;
      const currency = data.currency || 'GHS';
      const reference = data.reference || `PAYSTACK_${Date.now()}`;

      if (tenantId && plan) {
        await executeAutoUpgrade({
          tenantId,
          plan,
          billingCycle,
          studentLimit,
          amount,
          currency,
          gateway: 'paystack',
          reference,
        });
        console.log(`[Paystack Webhook] Successfully auto-upgraded ${tenantId} to ${plan}`);
      }
      return NextResponse.json({ received: true, gateway: 'paystack' });
    }

    // 2. Flutterwave Webhook Event
    if (
      event?.event === 'charge.completed' ||
      event?.['event.type'] === 'CARD_TRANSACTION' ||
      event?.data?.status === 'successful'
    ) {
      const data = event.data || {};
      const meta = data.meta || {};
      const tenantId = meta.tenantId;
      const plan = meta.plan;
      const billingCycle = meta.billingCycle || 'monthly';
      const studentLimit = Number(meta.studentLimit) || undefined;
      const amount = data.amount || 0;
      const currency = data.currency || 'GHS';
      const reference = data.tx_ref || `FLW_${Date.now()}`;

      if (tenantId && plan) {
        await executeAutoUpgrade({
          tenantId,
          plan,
          billingCycle,
          studentLimit,
          amount,
          currency,
          gateway: 'flutterwave',
          reference,
        });
        console.log(`[Flutterwave Webhook] Successfully auto-upgraded ${tenantId} to ${plan}`);
      }
      return NextResponse.json({ received: true, gateway: 'flutterwave' });
    }

    // 3. Stripe Webhook Event
    if (event?.type === 'checkout.session.completed') {
      const sessionObj = event.data?.object || {};
      const metadata = sessionObj.metadata || {};
      const tenantId = metadata.tenantId;
      const plan = metadata.plan;
      const billingCycle = metadata.billingCycle || 'monthly';
      const studentLimit = Number(metadata.studentLimit) || undefined;
      const amount = (sessionObj.amount_total || 0) / 100;
      const currency = (sessionObj.currency || 'ghs').toUpperCase();
      const reference = sessionObj.id || `STRIPE_${Date.now()}`;

      if (tenantId && plan) {
        await executeAutoUpgrade({
          tenantId,
          plan,
          billingCycle,
          studentLimit,
          amount,
          currency,
          gateway: 'stripe',
          reference,
        });
        console.log(`[Stripe Webhook] Successfully auto-upgraded ${tenantId} to ${plan}`);
      }
      return NextResponse.json({ received: true, gateway: 'stripe' });
    }

    return NextResponse.json({ received: true, unhandled: event?.event || event?.type });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: error.message || 'Webhook error' }, { status: 500 });
  }
}
