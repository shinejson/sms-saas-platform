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
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { parentName, studentId, relationship, isPrimary, billing, parentUserId, phone, email } = body;

    if (!parentName || !studentId) {
      return NextResponse.json(
        { error: 'Parent name and student are required.' },
        { status: 400 }
      );
    }

    // Verify parent mapping exists and belongs to current tenant
    const existing = await verifyTenantOwnership('parent', id, session.tenantId);

    // Resolve student
    const student = await prisma.student.findFirst({
      where: {
        tenantId: session.tenantId,
        OR: [
          { id: studentId },
          { studentId: studentId },
        ],
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Selected student not found in this school.' },
        { status: 404 }
      );
    }

    const updatedParent = await prisma.parent.update({
      where: { id },
      data: {
        parentName: parentName.trim(),
        studentId: student.id,
        relationship: relationship ? relationship.trim() : 'Guardian',
        isPrimary: Boolean(isPrimary),
        billing: billing ? String(billing).trim() : 'No',
        parentUserId: parentUserId || null,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
      },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Parent mapping updated successfully.',
      parent: updatedParent,
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
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const { id } = await params;

    // Verify mapping exists and belongs to current tenant
    await verifyTenantOwnership('parent', id, session.tenantId);

    await prisma.parent.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Parent mapping deleted successfully.',
    });
  } catch (error: any) {
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}
