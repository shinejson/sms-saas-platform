import { prisma } from '@/lib/prisma';
import {
  SUBSCRIPTION_PLANS,
  getBillingCycleDays,
  getPlanPrice,
} from '@/lib/subscriptions';

export type GatewayType = 'paystack' | 'flutterwave' | 'stripe' | 'sandbox';

export interface GatewayConfig {
  enabled: boolean;
  mode: 'test' | 'live';
  publicKey: string;
  secretKey: string;
  webhookSecret?: string;
  encryptionKey?: string;
  channels?: string[];
}

export interface PaymentGatewaySettings {
  defaultGateway: GatewayType;
  currency: string;
  paystack: GatewayConfig;
  flutterwave: GatewayConfig;
  stripe: GatewayConfig;
}

export function maskSecretKey(key?: string): string {
  if (!key || key.trim() === '') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 7)}••••••••${trimmed.slice(-4)}`;
}

export async function getTenantPaymentGateways(tenantId: string): Promise<PaymentGatewaySettings> {
  const settings = await prisma.setting.findMany({
    where: {
      tenantId,
      category: 'PaymentGateways',
    },
  });

  const getParam = (name: string): string => {
    return settings.find((s) => s.param === name)?.value || '';
  };

  const defaultGateway = (getParam('Default_Gateway') || 'paystack') as GatewayType;
  const currency = getParam('Platform_Currency') || 'GHS';

  // Paystack
  let paystack: GatewayConfig = {
    enabled: true,
    mode: 'test',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    channels: ['mobile_money', 'card'],
  };
  const paystackStored = getParam('Paystack_Config');
  if (paystackStored) {
    try {
      const parsed = JSON.parse(paystackStored);
      paystack = { ...paystack, ...parsed };
    } catch (e) {
      console.error('Error parsing Paystack config:', e);
    }
  }

  // Flutterwave
  let flutterwave: GatewayConfig = {
    enabled: false,
    mode: 'test',
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
    encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
    channels: ['mobilemoneyghana', 'card', 'banktransfer', 'ussd'],
  };
  const flutterwaveStored = getParam('Flutterwave_Config');
  if (flutterwaveStored) {
    try {
      const parsed = JSON.parse(flutterwaveStored);
      flutterwave = { ...flutterwave, ...parsed };
    } catch (e) {
      console.error('Error parsing Flutterwave config:', e);
    }
  }

  // Stripe
  let stripe: GatewayConfig = {
    enabled: false,
    mode: 'test',
    publicKey: process.env.STRIPE_PUBLIC_KEY || '',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
  };
  const stripeStored = getParam('Stripe_Config');
  if (stripeStored) {
    try {
      const parsed = JSON.parse(stripeStored);
      stripe = { ...stripe, ...parsed };
    } catch (e) {
      console.error('Error parsing Stripe config:', e);
    }
  }

  return {
    defaultGateway,
    currency,
    paystack,
    flutterwave,
    stripe,
  };
}

export async function saveTenantPaymentGateways(
  tenantId: string,
  updated: Partial<PaymentGatewaySettings>
): Promise<PaymentGatewaySettings> {
  const existing = await getTenantPaymentGateways(tenantId);

  const mergedPaystack: GatewayConfig = {
    ...existing.paystack,
    ...(updated.paystack || {}),
  };
  // If the secret key is masked with bullets, preserve the existing unmasked secret
  if (updated.paystack?.secretKey && updated.paystack.secretKey.includes('••••')) {
    mergedPaystack.secretKey = existing.paystack.secretKey;
  }

  const mergedFlutterwave: GatewayConfig = {
    ...existing.flutterwave,
    ...(updated.flutterwave || {}),
  };
  if (updated.flutterwave?.secretKey && updated.flutterwave.secretKey.includes('••••')) {
    mergedFlutterwave.secretKey = existing.flutterwave.secretKey;
  }
  if (updated.flutterwave?.encryptionKey && updated.flutterwave.encryptionKey.includes('••••')) {
    mergedFlutterwave.encryptionKey = existing.flutterwave.encryptionKey;
  }

  const mergedStripe: GatewayConfig = {
    ...existing.stripe,
    ...(updated.stripe || {}),
  };
  if (updated.stripe?.secretKey && updated.stripe.secretKey.includes('••••')) {
    mergedStripe.secretKey = existing.stripe.secretKey;
  }

  const defaultGateway = updated.defaultGateway || existing.defaultGateway;
  const currency = updated.currency || existing.currency;

  const upsertSetting = async (param: string, value: string) => {
    await prisma.setting.upsert({
      where: { tenantId_param: { tenantId, param } },
      update: { value, category: 'PaymentGateways' },
      create: { tenantId, param, value, category: 'PaymentGateways' },
    });
  };

  await Promise.all([
    upsertSetting('Default_Gateway', defaultGateway),
    upsertSetting('Platform_Currency', currency),
    upsertSetting('Paystack_Config', JSON.stringify(mergedPaystack)),
    upsertSetting('Flutterwave_Config', JSON.stringify(mergedFlutterwave)),
    upsertSetting('Stripe_Config', JSON.stringify(mergedStripe)),
  ]);

  return getTenantPaymentGateways(tenantId);
}

export interface InitializePaymentParams {
  gateway: GatewayType;
  amount: number;
  currency?: string;
  email: string;
  tenantId: string;
  plan: string;
  studentLimit: number;
  billingCycle: string;
  callbackUrl?: string;
  simulate?: boolean;
}

export interface InitializePaymentResponse {
  success: boolean;
  activated?: boolean;
  authorizationUrl?: string;
  reference: string;
  gateway: GatewayType;
  amount: number;
  currency: string;
  message?: string;
}

export async function initializeGatewayPayment(
  params: InitializePaymentParams
): Promise<InitializePaymentResponse> {
  const {
    gateway,
    amount,
    currency = 'GHS',
    email,
    tenantId,
    plan,
    studentLimit,
    billingCycle,
    callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?tab=subscription&payment=success`,
    simulate = false,
  } = params;

  const configs = await getTenantPaymentGateways(tenantId);

  // 1. Sandbox / Simulation Mode
  if (gateway === 'sandbox' || simulate) {
    const reference = 'SANDBOX_' + Date.now();
    await executeAutoUpgrade({
      tenantId,
      plan,
      billingCycle,
      studentLimit,
      amount,
      currency,
      gateway: 'sandbox',
      reference,
    });

    return {
      success: true,
      activated: true,
      reference,
      gateway: 'sandbox',
      amount,
      currency,
      message: `Successfully upgraded to ${plan} plan via Sandbox Instant Demo!`,
    };
  }

  // 2. Paystack
  if (gateway === 'paystack') {
    const secretKey = configs.paystack.secretKey;
    const isMock = !secretKey || secretKey.startsWith('sk_test_replace') || secretKey.trim() === '';

    if (isMock) {
      // Auto-fallback to Sandbox if Paystack secret is placeholder
      const reference = 'PAYSTACK_MOCK_' + Date.now();
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

      return {
        success: true,
        activated: true,
        reference,
        gateway: 'paystack',
        amount,
        currency,
        message: `Paystack Test Mode: Auto-upgraded to ${plan} plan (Sandbox Mode).`,
      };
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // in Pesewas (kobo)
        currency,
        channels: configs.paystack.channels || ['mobile_money', 'card'],
        callback_url: `${callbackUrl}&gateway=paystack`,
        metadata: {
          tenantId,
          plan,
          studentLimit,
          billingCycle,
        },
      }),
    });

    const data = await paystackRes.json();
    if (!data.status) {
      throw new Error(data.message || 'Paystack payment initialization failed.');
    }

    return {
      success: true,
      activated: false,
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
      gateway: 'paystack',
      amount,
      currency,
    };
  }

  // 3. Flutterwave
  if (gateway === 'flutterwave') {
    const secretKey = configs.flutterwave.secretKey;
    const isMock = !secretKey || secretKey.startsWith('FLWSECK_TEST_replace') || secretKey.trim() === '';

    if (isMock) {
      const reference = 'FLW_MOCK_' + Date.now();
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

      return {
        success: true,
        activated: true,
        reference,
        gateway: 'flutterwave',
        amount,
        currency,
        message: `Flutterwave Test Mode: Auto-upgraded to ${plan} plan (Sandbox Mode).`,
      };
    }

    const tx_ref = `FLW_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref,
        amount,
        currency,
        redirect_url: `${callbackUrl}&gateway=flutterwave&reference=${tx_ref}`,
        customer: {
          email,
          name: email.split('@')[0],
        },
        customizations: {
          title: `${plan} Plan Subscription`,
          description: `Online school portal license (${billingCycle})`,
        },
        meta: {
          tenantId,
          plan,
          studentLimit,
          billingCycle,
        },
      }),
    });

    const data = await flwRes.json();
    if (data.status !== 'success' || !data.data?.link) {
      throw new Error(data.message || 'Flutterwave payment initialization failed.');
    }

    return {
      success: true,
      activated: false,
      authorizationUrl: data.data.link,
      reference: tx_ref,
      gateway: 'flutterwave',
      amount,
      currency,
    };
  }

  // 4. Stripe
  if (gateway === 'stripe') {
    const secretKey = configs.stripe.secretKey;
    const isMock = !secretKey || secretKey.startsWith('sk_test_replace') || secretKey.trim() === '';

    if (isMock) {
      const reference = 'STRIPE_MOCK_' + Date.now();
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

      return {
        success: true,
        activated: true,
        reference,
        gateway: 'stripe',
        amount,
        currency,
        message: `Stripe Test Mode: Auto-upgraded to ${plan} plan (Sandbox Mode).`,
      };
    }

    const stripeParams = new URLSearchParams();
    stripeParams.append('mode', 'payment');
    stripeParams.append('success_url', `${callbackUrl}&gateway=stripe&session_id={CHECKOUT_SESSION_ID}`);
    stripeParams.append('cancel_url', `${callbackUrl}&payment=cancelled`);
    stripeParams.append('customer_email', email);
    stripeParams.append('line_items[0][price_data][currency]', (currency || 'ghs').toLowerCase());
    stripeParams.append('line_items[0][price_data][unit_amount]', Math.round(amount * 100).toString());
    stripeParams.append('line_items[0][price_data][product_data][name]', `${plan} Plan Subscription (${billingCycle})`);
    stripeParams.append('metadata[tenantId]', tenantId);
    stripeParams.append('metadata[plan]', plan);
    stripeParams.append('metadata[studentLimit]', studentLimit.toString());
    stripeParams.append('metadata[billingCycle]', billingCycle);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeParams.toString(),
    });

    const data = await stripeRes.json();
    if (data.error || !data.url) {
      throw new Error(data.error?.message || 'Stripe checkout session initialization failed.');
    }

    return {
      success: true,
      activated: false,
      authorizationUrl: data.url,
      reference: data.id,
      gateway: 'stripe',
      amount,
      currency,
    };
  }

  throw new Error(`Unsupported payment gateway: ${gateway}`);
}

export interface VerifyPaymentParams {
  gateway: GatewayType;
  reference: string;
  tenantId: string;
  fallbackPlan?: string;
  fallbackBillingCycle?: string;
}

export async function verifyGatewayPayment(params: VerifyPaymentParams) {
  const { gateway, reference, tenantId, fallbackPlan = 'SILVER', fallbackBillingCycle = 'monthly' } = params;
  const configs = await getTenantPaymentGateways(tenantId);

  // 1. Sandbox or mock references
  if (
    gateway === 'sandbox' ||
    reference.startsWith('SANDBOX_') ||
    reference.startsWith('SIM_') ||
    reference.includes('_MOCK_')
  ) {
    const planConfig = SUBSCRIPTION_PLANS[fallbackPlan?.toUpperCase()] || SUBSCRIPTION_PLANS.SILVER;
    return executeAutoUpgrade({
      tenantId,
      plan: planConfig.key,
      studentLimit: planConfig.studentLimit,
      billingCycle: fallbackBillingCycle,
      amount: getPlanPrice(planConfig.key, fallbackBillingCycle),
      currency: configs.currency,
      gateway,
      reference,
    });
  }

  // 2. Paystack
  if (gateway === 'paystack') {
    const secretKey = configs.paystack.secretKey;
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      throw new Error(verifyData.message || 'Paystack payment verification was not successful.');
    }

    const metadata = verifyData.data.metadata || {};
    const planKey = metadata.plan || fallbackPlan;
    const billingCycle = metadata.billingCycle || fallbackBillingCycle;
    const planConfig = SUBSCRIPTION_PLANS[planKey?.toUpperCase()] || SUBSCRIPTION_PLANS.SILVER;
    const amount = verifyData.data.amount / 100;
    const currency = verifyData.data.currency || 'GHS';

    return executeAutoUpgrade({
      tenantId,
      plan: planConfig.key,
      studentLimit: planConfig.studentLimit,
      billingCycle,
      amount,
      currency,
      gateway: 'paystack',
      reference,
    });
  }

  // 3. Flutterwave
  if (gateway === 'flutterwave') {
    const secretKey = configs.flutterwave.secretKey;
    const flwRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );
    const flwData = await flwRes.json();

    if (flwData.status !== 'success' || flwData.data.status !== 'successful') {
      throw new Error(flwData.message || 'Flutterwave payment verification was not successful.');
    }

    const meta = flwData.data.meta || {};
    const planKey = meta.plan || fallbackPlan;
    const billingCycle = meta.billingCycle || fallbackBillingCycle;
    const planConfig = SUBSCRIPTION_PLANS[planKey?.toUpperCase()] || SUBSCRIPTION_PLANS.SILVER;
    const amount = flwData.data.amount;
    const currency = flwData.data.currency || 'GHS';

    return executeAutoUpgrade({
      tenantId,
      plan: planConfig.key,
      studentLimit: planConfig.studentLimit,
      billingCycle,
      amount,
      currency,
      gateway: 'flutterwave',
      reference,
    });
  }

  // 4. Stripe
  if (gateway === 'stripe') {
    const secretKey = configs.stripe.secretKey;
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const sessionData = await stripeRes.json();

    if (sessionData.error || sessionData.payment_status !== 'paid') {
      throw new Error(sessionData.error?.message || 'Stripe checkout session not paid.');
    }

    const metadata = sessionData.metadata || {};
    const planKey = metadata.plan || fallbackPlan;
    const billingCycle = metadata.billingCycle || fallbackBillingCycle;
    const planConfig = SUBSCRIPTION_PLANS[planKey?.toUpperCase()] || SUBSCRIPTION_PLANS.SILVER;
    const amount = (sessionData.amount_total || 0) / 100;
    const currency = (sessionData.currency || 'ghs').toUpperCase();

    return executeAutoUpgrade({
      tenantId,
      plan: planConfig.key,
      studentLimit: planConfig.studentLimit,
      billingCycle,
      amount,
      currency,
      gateway: 'stripe',
      reference,
    });
  }

  throw new Error(`Unsupported gateway for verification: ${gateway}`);
}

export interface ExecuteAutoUpgradeParams {
  tenantId: string;
  plan: string;
  billingCycle: string;
  studentLimit?: number;
  amount: number;
  currency?: string;
  gateway: string;
  reference: string;
}

export async function executeAutoUpgrade(params: ExecuteAutoUpgradeParams) {
  const {
    tenantId,
    plan: rawPlanKey,
    billingCycle,
    amount,
    currency = 'GHS',
    gateway,
    reference,
  } = params;

  const planKey = (rawPlanKey || 'SILVER').toUpperCase();
  const planConfig = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.SILVER;
  const studentLimit = params.studentLimit || planConfig.studentLimit;
  const cycleDays = getBillingCycleDays(billingCycle);

  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date(Date.now() + cycleDays * 24 * 60 * 60 * 1000);

  const [updatedTenant, newSubscription] = await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: planKey as any,
        studentLimit,
        status: 'ACTIVE',
      },
    }),
    prisma.subscription.create({
      data: {
        tenantId,
        plan: planKey as any,
        studentLimit,
        amount,
        currency,
        billingCycle,
        status: 'active',
        paymentGateway: gateway,
        gatewayReference: reference,
        currentPeriodStart,
        currentPeriodEnd,
      },
    }),
  ]);

  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'SUBSCRIPTION_AUTO_UPGRADE',
        entity: 'SUBSCRIPTION',
        details: `Auto-upgraded to ${planConfig.name} (${billingCycle}) via ${gateway.toUpperCase()}. Reference: ${reference}. Valid until ${currentPeriodEnd.toISOString()}`,
      },
    });
  } catch (e) {
    console.error('AuditLog creation error on upgrade:', e);
  }

  return {
    tenant: updatedTenant,
    subscription: newSubscription,
  };
}
