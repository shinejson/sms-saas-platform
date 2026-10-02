import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { verifyTenantOwnership } from '@/lib/tenant-security';
import { sanitizeError } from '@/lib/errors';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Class name is required.' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Verify the class belongs to this tenant
    const existing = await verifyTenantOwnership('class', id, session.tenantId);

    // Check for duplicate name in the same tenant excluding this class
    const duplicate = await prisma.class.findFirst({
      where: {
        tenantId: session.tenantId,
        name: { equals: trimmedName, mode: 'insensitive' },
        NOT: { id },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: `Another class named "${trimmedName}" already exists.` },
        { status: 409 }
      );
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data: {
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
      message: `Class "${updatedClass.name}" updated successfully.`,
      class: updatedClass,
    });
  } catch (error: any) {
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify class belongs to tenant and count enrolled students
    const existing = await verifyTenantOwnership<any>('class', id, session.tenantId);
    
    const classWithCount = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!classWithCount) {
      return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
    }

    // Safety guard: cannot delete class if enrolled students > 0 (GAS line 3407)
    if (classWithCount._count.students > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete "${classWithCount.name}" because ${classWithCount._count.students} student(s) are currently assigned to this class. Move or remove students before deleting this class.`,
        },
        { status: 400 }
      );
    }

    await prisma.class.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Class "${classWithCount.name}" deleted successfully.`,
    });
  } catch (error: any) {
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}
