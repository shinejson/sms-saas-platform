import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, hashPassword } from '@/lib/auth';
import { Role, AccountStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    const users = await prisma.user.findMany({
      where: {
        tenantId: session.tenantId,
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { username: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const body = await req.json();
    const { email, fullName, username, password, role, status } = body;

    if (!email || !fullName) {
      return NextResponse.json(
        { error: 'Email and full name are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const plainPassword = password && password.trim() ? password.trim() : 'Password123';
    const passwordHash = await hashPassword(plainPassword);

    // Validate role against Prisma Role enum
    const validRoles = Object.values(Role);
    const assignedRole = validRoles.includes(role as Role) ? (role as Role) : Role.TEACHER;

    // Validate status against Prisma AccountStatus enum
    const validStatuses = Object.values(AccountStatus);
    const assignedStatus = validStatuses.includes(status as AccountStatus)
      ? (status as AccountStatus)
      : AccountStatus.ACTIVE;

    const newUser = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        email: cleanEmail,
        fullName: fullName.trim(),
        username: username ? username.trim() : null,
        passwordHash,
        role: assignedRole,
        status: assignedStatus,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully.',
      user: newUser,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A user with this email address already exists in this school.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
