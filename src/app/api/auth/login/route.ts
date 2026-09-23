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
