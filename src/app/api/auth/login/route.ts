import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, subdomain } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Single query: look up user (+ tenant) scoped to subdomain when provided,
    // falling back to a global email search so Super Admin can always log in.
    const user = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        ...(subdomain
          ? { tenant: { subdomain: subdomain.toLowerCase().trim() } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tenantId: true,
        passwordHash: true,
        status: true,
        tenant: {
          select: {
            id: true,
            name: true,
            alias: true,
            subdomain: true,
            plan: true,
            currency: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      return NextResponse.json(
        { error: 'Your account has been suspended or deactivated. Contact your administrator.' },
        { status: 403 }
      );
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
      tenant: user.tenant,
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
