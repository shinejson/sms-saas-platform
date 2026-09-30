import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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

    const permissions = await prisma.permission.findMany({
      where: {
        tenantId: session.tenantId,
        ...(query
          ? {
              OR: [
                { role: { contains: query, mode: 'insensitive' } },
                { accessLevel: { contains: query, mode: 'insensitive' } },
                { actions: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, permissions });
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
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
    const { role, accessLevel, actions } = body;

    if (!role || !accessLevel || !actions) {
      return NextResponse.json(
        { error: 'Role name, access level, and permitted actions are required.' },
        { status: 400 }
      );
    }

    const cleanRole = role.trim();

    // Check if permission role already exists in tenant
    const existing = await prisma.permission.findFirst({
      where: {
        tenantId: session.tenantId,
        role: { equals: cleanRole, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A permission role for "${cleanRole}" already exists.` },
        { status: 409 }
      );
    }

    const newPermission = await prisma.permission.create({
      data: {
        tenantId: session.tenantId,
        role: cleanRole,
        accessLevel: accessLevel.trim(),
        actions: actions.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Permission role created successfully.',
      permission: newPermission,
    });
  } catch (error: any) {
    console.error('Error creating permission:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A permission for this role already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
