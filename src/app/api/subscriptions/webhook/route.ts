import { NextRequest, NextResponse } from 'next/server';
import { executeAutoUpgrade } from '@/lib/payment-gateways';
import crypto from 'crypto';

/**
 * Verifies Paystack webhook signature using HMAC SHA512
 */
function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('[Security] PAYSTACK_SECRET_KEY not configured');
    return false;
  }
  
  if (!signature) {
    return false;
  }
  
  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  
  return hash === signature;
}

/**
 * Verifies Flutterwave webhook signature
 */
function verifyFlutterwaveSignature(verifHash: string | null): boolean {
  const secret = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secret) {
    console.error('[Security] FLUTTERWAVE_SECRET_HASH not configured');
    return false;
  }
  
  if (!verifHash) {
    return false;
  }
  
  return verifHash === secret;
}

/**
 * Verifies Stripe webhook signature using HMAC SHA256
 */
function verifyStripeSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Security] STRIPE_WEBHOOK_SECRET not configured');
    return false;
  }
  
  if (!signature) {
    return false;
  }
  
  // Stripe signature format: t=timestamp,v1=signature
  const elements = signature.split(',');
  const signatureMap: Record<string, string> = {};
  
  for (const element of elements) {
    const [key, value] = element.split('=');
    signatureMap[key] = value;
  }
  
  const timestamp = signatureMap['t'];
  const expectedSig = signatureMap['v1'];
  
  if (!timestamp || !expectedSig) {
    return false;
  }
  
  const payload = `${timestamp}.${rawBody}`;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return hash === expectedSig;
}

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
      const paystackSignature = req.headers.get('x-paystack-signature');
      if (!verifyPaystackSignature(rawBody, paystackSignature)) {
        console.warn('[Security] Invalid Paystack webhook signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
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
      const flwVerifHash = req.headers.get('verif-hash');
      if (!verifyFlutterwaveSignature(flwVerifHash)) {
        console.warn('[Security] Invalid Flutterwave webhook signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
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
      const stripeSignature = req.headers.get('stripe-signature');
      if (!verifyStripeSignature(rawBody, stripeSignature)) {
        console.warn('[Security] Invalid Stripe webhook signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
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
