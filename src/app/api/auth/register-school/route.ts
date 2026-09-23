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
          year: `${currentYear}/${currentYear + 1}`,
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
