const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const fullPath = path.join(__dirname, '..', filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`Created: ${filePath}`);
}

// 1. Prisma Client Singleton
write('src/lib/prisma.ts', `
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
`);

// 2. Auth & JWT Utilities
write('src/lib/auth.ts', `
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sms-saas-super-secret-jwt-key-2026';

export interface UserSessionPayload {
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
  subdomain: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: UserSessionPayload, expiresIn = '8h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): UserSessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSessionPayload;
  } catch (err) {
    return null;
  }
}
`);

// 3. Multi-Tenant Resolver & Limits
write('src/lib/tenant.ts', `
import { prisma } from './prisma';

export async function resolveTenantBySubdomain(subdomain: string) {
  if (!subdomain) return null;
  return prisma.tenant.findUnique({
    where: { subdomain: subdomain.toLowerCase().trim() },
    include: {
      subscriptions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function verifyTenantStudentQuota(tenantId: string): Promise<{
  canAdd: boolean;
  currentCount: number;
  limit: number;
  plan: string;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, studentLimit: true },
  });

  if (!tenant) throw new Error('School tenant not found');

  const currentCount = await prisma.student.count({
    where: { tenantId, status: 'ACTIVE' },
  });

  return {
    canAdd: currentCount < tenant.studentLimit,
    currentCount,
    limit: tenant.studentLimit,
    plan: tenant.plan,
  };
}
`);

// 4. Environment Variables
write('.env', `
# Database (PostgreSQL) - Replace with your Neon, Supabase or local PostgreSQL URL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sms_saas?schema=public"

# Auth
JWT_SECRET="sms-saas-production-jwt-secret-replace-me-random-64-chars"

# SaaS Billing Gateways
PAYSTACK_SECRET_KEY="sk_test_replace_with_paystack_secret"
PAYSTACK_PUBLIC_KEY="pk_test_replace_with_paystack_public"
STRIPE_SECRET_KEY="sk_test_replace_with_stripe_secret"

# App URL
NEXT_PUBLIC_APP_DOMAIN="smsapp.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
`);

write('.env.example', `
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sms_saas?schema=public"
JWT_SECRET="change-this-in-production"
PAYSTACK_SECRET_KEY=""
PAYSTACK_PUBLIC_KEY=""
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_APP_DOMAIN="smsapp.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
`);

// 5. School Registration API (Onboarding new school SaaS tenant)
write('src/app/api/auth/register-school/route.ts', `
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      schoolName,
      schoolAlias,
      subdomain,
      adminFullName,
      adminEmail,
      adminPassword,
      currency,
    } = body;

    if (!schoolName || !subdomain || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Please provide all required fields' },
        { status: 400 }
      );
    }

    const cleanSubdomain = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

    // Check if subdomain already taken
    const existing = await prisma.tenant.findUnique({
      where: { subdomain: cleanSubdomain },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'School subdomain is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(adminPassword);

    // Create Tenant + Default School Admin in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: schoolName,
          alias: schoolAlias || 'SMS',
          subdomain: cleanSubdomain,
          currency: currency || 'GHS',
          plan: 'DEMO',
          studentLimit: 15, // Free Demo quota
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          fullName: adminFullName,
          email: adminEmail.toLowerCase().trim(),
          passwordHash,
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE',
        },
      });

      // Seed initial active academic year
      const currentYear = new Date().getFullYear();
      await tx.academicYear.create({
        data: {
          tenantId: tenant.id,
          year: \`\${currentYear}/\${currentYear + 1}\`,
          status: 'Active',
          currentTerm: 'Term 1',
        },
      });

      // Seed standard billing categories
      await tx.billingCategory.createMany({
        data: [
          { tenantId: tenant.id, name: 'Tuition Fee', defaultAmount: 250.0 },
          { tenantId: tenant.id, name: 'PTA Dues', defaultAmount: 30.0 },
          { tenantId: tenant.id, name: 'Books & Supplies', defaultAmount: 100.0 },
        ],
      });

      return { tenant, user };
    });

    const token = generateToken({
      userId: result.user.id,
      tenantId: result.tenant.id,
      email: result.user.email,
      fullName: result.user.fullName,
      role: result.user.role,
      subdomain: result.tenant.subdomain,
    });

    return NextResponse.json({
      success: true,
      message: 'School registered successfully!',
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
        plan: result.tenant.plan,
        studentLimit: result.tenant.studentLimit,
      },
      token,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
`);

// 6. User Login API
write('src/app/api/auth/login/route.ts', `
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, subdomain } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    let tenantId: string | undefined;

    if (subdomain) {
      const tenant = await prisma.tenant.findUnique({
        where: { subdomain: subdomain.toLowerCase().trim() },
      });
      if (!tenant) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }
      tenantId = tenant.id;
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        ...(tenantId ? { tenantId } : {}),
      },
      include: { tenant: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = generateToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      subdomain: user.tenant.subdomain,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        alias: user.tenant.alias,
        subdomain: user.tenant.subdomain,
        plan: user.tenant.plan,
        currency: user.tenant.currency,
      },
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
`);

// 7. Google Sheets Data Migration API
write('src/app/api/migrate/route.ts', `
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

/**
 * Migration endpoint to import existing data from Google Apps Script SMS
 * into the SaaS tenant database.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'SCHOOL_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity, rows } = await req.json();
    const tenantId = session.tenantId;

    if (!entity || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let importedCount = 0;

    if (entity === 'students') {
      for (const row of rows) {
        if (!row.studentId || !row.firstName || !row.lastName) continue;
        await prisma.student.upsert({
          where: {
            tenantId_studentId: { tenantId, studentId: String(row.studentId).trim() },
          },
          update: {
            firstName: String(row.firstName).trim(),
            lastName: String(row.lastName).trim(),
            gender: row.gender || null,
            status: row.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
          },
          create: {
            tenantId,
            studentId: String(row.studentId).trim(),
            firstName: String(row.firstName).trim(),
            lastName: String(row.lastName).trim(),
            gender: row.gender || null,
            status: row.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
          },
        });
        importedCount++;
      }
    } else if (entity === 'courses' || entity === 'subjects') {
      for (const row of rows) {
        const name = String(row.name || row.courseName || row.subjectName || '').trim();
        if (!name) continue;
        await prisma.subject.upsert({
          where: {
            tenantId_name: { tenantId, name },
          },
          update: {
            code: row.code || null,
            credits: Number(row.credits) || 1,
            semester: row.semester || null,
          },
          create: {
            tenantId,
            name,
            code: row.code || null,
            credits: Number(row.credits) || 1,
            semester: row.semester || null,
          },
        });
        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      entity,
      importedCount,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`);

console.log('SaaS core files generated successfully!');
