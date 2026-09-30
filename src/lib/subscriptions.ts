export interface PlanTierConfig {
  key: string;
  name: string;
  studentLimit: number;
  priceMonthly: number;
  priceTermly: number;
  priceAnnual: number;
  popular?: boolean;
  description: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, PlanTierConfig> = {
  DEMO: {
    key: 'DEMO',
    name: 'Free Trial',
    studentLimit: 15,
    priceMonthly: 0,
    priceTermly: 0,
    priceAnnual: 0,
    description: 'Free trial evaluation for new schools with core management features.',
    features: [
      'Up to 15 enrolled students',
      'Basic student registration',
      'Class & subject management',
      'Standard attendance recording',
      'Trial duration: 14 days',
    ],
  },
  COPPER: {
    key: 'COPPER',
    name: 'Copper Plan',
    studentLimit: 100,
    priceMonthly: 150,
    priceTermly: 540,
    priceAnnual: 1440,
    description: 'Ideal for creches, nursery, and small community preschools.',
    features: [
      'Up to 100 enrolled students',
      'Unlimited classes & subjects',
      'Ghanaian grading system',
      'Student fee billing & MoMo receipts',
      'Attendance tracker with export',
      'Basic terminal reports',
    ],
  },
  SILVER: {
    key: 'SILVER',
    name: 'Silver Plan',
    studentLimit: 250,
    priceMonthly: 300,
    priceTermly: 1080,
    priceAnnual: 2880,
    popular: true,
    description: 'Perfect for standard primary and basic schools.',
    features: [
      'Up to 250 enrolled students',
      'Full Ghanaian WAEC/GES terminal report generator',
      'Advanced multi-column grade entry',
      'CSV batch performance & student import',
      'Fee arrears tracking & receipt generation',
      'Parent portal access',
      'Standard email & MoMo support',
    ],
  },
  DIAMOND: {
    key: 'DIAMOND',
    name: 'Diamond Plan',
    studentLimit: 400,
    priceMonthly: 450,
    priceTermly: 1620,
    priceAnnual: 4320,
    description: 'Designed for established basic and junior high schools.',
    features: [
      'Up to 400 enrolled students',
      'Custom school logo & branding on report cards',
      'Automated terminal position / class ranking',
      'Batch invoice dispatch & receipt slips',
      'Teacher grade submission workflow',
      'Priority telephone & WhatsApp support',
    ],
  },
  GOLD: {
    key: 'GOLD',
    name: 'Gold Plan',
    studentLimit: 600,
    priceMonthly: 600,
    priceTermly: 2160,
    priceAnnual: 5760,
    description: 'Comprehensive solution for large K-12 and high schools.',
    features: [
      'Up to 600 enrolled students',
      'Multi-term historical performance analytics',
      'Automated SMS payment alerts to parents',
      'Staff payroll & audit log trail',
      'Bulk data migration tools',
      'Dedicated account manager',
    ],
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    name: 'Enterprise Plan',
    studentLimit: 2000,
    priceMonthly: 1200,
    priceTermly: 4320,
    priceAnnual: 11520,
    description: 'Tailored for multi-branch school networks and college campuses.',
    features: [
      '2,000+ enrolled students',
      'Multi-campus consolidated dashboard',
      'Custom domain & custom branding',
      'Dedicated cloud database instance',
      '99.9% uptime SLA & 24/7 emergency support',
      'Custom API & biometric hardware integrations',
    ],
  },
};

export interface SubscriptionStatusInfo {
  status: 'active' | 'expiring_soon' | 'expired';
  daysRemaining: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  currentPeriodEnd: string;
}

export function calculateSubscriptionStatus(
  periodEnd: Date | string,
  tenantStatus?: string
): SubscriptionStatusInfo {
  if (tenantStatus === 'SUSPENDED') {
    return {
      status: 'expired',
      daysRemaining: 0,
      isExpiringSoon: false,
      isExpired: true,
      currentPeriodEnd: new Date(periodEnd).toISOString(),
    };
  }

  const end = new Date(periodEnd).getTime();
  const now = Date.now();
  const diffMs = end - now;
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return {
      status: 'expired',
      daysRemaining: 0,
      isExpiringSoon: false,
      isExpired: true,
      currentPeriodEnd: new Date(periodEnd).toISOString(),
    };
  }

  if (daysRemaining <= 7) {
    return {
      status: 'expiring_soon',
      daysRemaining,
      isExpiringSoon: true,
      isExpired: false,
      currentPeriodEnd: new Date(periodEnd).toISOString(),
    };
  }

  return {
    status: 'active',
    daysRemaining,
    isExpiringSoon: false,
    isExpired: false,
    currentPeriodEnd: new Date(periodEnd).toISOString(),
  };
}

export function getBillingCycleDays(cycle: string): number {
  switch (cycle?.toLowerCase()) {
    case 'annual':
    case 'yearly':
      return 365;
    case 'termly':
      return 120; // 4 months for 1 school term
    case 'monthly':
    default:
      return 30;
  }
}

export function getPlanPrice(planKey: string, cycle: string): number {
  const plan = SUBSCRIPTION_PLANS[planKey?.toUpperCase()];
  if (!plan) return 0;

  switch (cycle?.toLowerCase()) {
    case 'annual':
    case 'yearly':
      return plan.priceAnnual;
    case 'termly':
      return plan.priceTermly;
    case 'monthly':
    default:
      return plan.priceMonthly;
  }
}
