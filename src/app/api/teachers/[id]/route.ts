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
    const { firstName, lastName, className, academicYear } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required.' },
        { status: 400 }
      );
    }

    // Verify the teacher belongs to this tenant
    const existing = await verifyTenantOwnership('teacher', id, session.tenantId);

    const updatedTeacher = await prisma.teacher.update({
      where: { id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        className: className ? className.trim() : null,
        academicYear: academicYear ? academicYear.trim() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Teacher updated successfully.',
      teacher: updatedTeacher,
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

    // Verify the teacher belongs to this tenant
    await verifyTenantOwnership('teacher', id, session.tenantId);

    await prisma.teacher.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Teacher deleted successfully.' });
  } catch (error: any) {
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}
