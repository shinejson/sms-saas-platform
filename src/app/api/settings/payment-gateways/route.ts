import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  getTenantPaymentGateways,
  saveTenantPaymentGateways,
  maskSecretKey,
} from '@/lib/payment-gateways';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired.' }, { status: 401 });
    }

    const gateways = await getTenantPaymentGateways(session.tenantId);

    // Return masked credentials for security in UI
    return NextResponse.json({
      success: true,
      settings: {
        defaultGateway: gateways.defaultGateway,
        currency: gateways.currency,
        paystack: {
          enabled: gateways.paystack.enabled,
          mode: gateways.paystack.mode,
          publicKey: gateways.paystack.publicKey,
          secretKey: maskSecretKey(gateways.paystack.secretKey),
          hasSecretKey: !!gateways.paystack.secretKey && gateways.paystack.secretKey.length > 5,
          channels: gateways.paystack.channels || ['mobile_money', 'card'],
        },
        flutterwave: {
          enabled: gateways.flutterwave.enabled,
          mode: gateways.flutterwave.mode,
          publicKey: gateways.flutterwave.publicKey,
          secretKey: maskSecretKey(gateways.flutterwave.secretKey),
          hasSecretKey: !!gateways.flutterwave.secretKey && gateways.flutterwave.secretKey.length > 5,
          encryptionKey: maskSecretKey(gateways.flutterwave.encryptionKey),
          channels: gateways.flutterwave.channels || ['mobilemoneyghana', 'card', 'banktransfer', 'ussd'],
        },
        stripe: {
          enabled: gateways.stripe.enabled,
          mode: gateways.stripe.mode,
          publicKey: gateways.stripe.publicKey,
          secretKey: maskSecretKey(gateways.stripe.secretKey),
          hasSecretKey: !!gateways.stripe.secretKey && gateways.stripe.secretKey.length > 5,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching payment gateways config:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'SCHOOL_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Administrator privilege required.' }, { status: 401 });
    }

    const body = await req.json();
    const updated = await saveTenantPaymentGateways(session.tenantId, body);

    return NextResponse.json({
      success: true,
      message: 'Payment gateway configurations saved successfully.',
      settings: {
        defaultGateway: updated.defaultGateway,
        currency: updated.currency,
        paystack: {
          ...updated.paystack,
          secretKey: maskSecretKey(updated.paystack.secretKey),
          hasSecretKey: !!updated.paystack.secretKey,
        },
        flutterwave: {
          ...updated.flutterwave,
          secretKey: maskSecretKey(updated.flutterwave.secretKey),
          hasSecretKey: !!updated.flutterwave.secretKey,
          encryptionKey: maskSecretKey(updated.flutterwave.encryptionKey),
        },
        stripe: {
          ...updated.stripe,
          secretKey: maskSecretKey(updated.stripe.secretKey),
          hasSecretKey: !!updated.stripe.secretKey,
        },
      },
    });
  } catch (error: any) {
    console.error('Error saving payment gateways config:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
