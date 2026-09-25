import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Super Admin access required.' }, { status: 403 });
    }

    const admins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, admins });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Super Admin access required.' }, { status: 403 });
    }

    const { email, password, fullName } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Full name, email, and password are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: { email: cleanEmail },
    });

    const passwordHash = await hashPassword(password);

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'SUPER_ADMIN',
          passwordHash,
          fullName,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: `User ${cleanEmail} promoted to SUPER_ADMIN`,
        user: updated,
      });
    }

    // Assign to same tenant as current superadmin or master tenant
    const user = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        email: cleanEmail,
        fullName,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `New Super Admin ${cleanEmail} created`,
      user,
    });
  } catch (error: any) {
    console.error('Error creating super admin user:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
