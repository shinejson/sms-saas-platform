import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    const classes = await prisma.class.findMany({
      where: {
        tenantId: session.tenantId,
        ...(query
          ? {
              name: { contains: query, mode: 'insensitive' },
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
          },
        },
        classTeacher: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, classes });
  } catch (error: any) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Class name is required.' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Check for duplicate class name within tenant
    const existing = await prisma.class.findFirst({
      where: {
        tenantId: session.tenantId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A class named "${trimmedName}" already exists.` },
        { status: 409 }
      );
    }

    const newClass = await prisma.class.create({
      data: {
        tenantId: session.tenantId,
        name: trimmedName,
      },
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
          },
        },
        classTeacher: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Class "${newClass.name}" created successfully!`,
      class: newClass,
    });
  } catch (error: any) {
    console.error('Error creating class:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A class with this name already exists in your school.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
