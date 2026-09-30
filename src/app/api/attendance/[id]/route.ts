import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { AttendanceStatus } from '@prisma/client';

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
    const { status, notes, date, term } = body;

    const existing = await prisma.attendance.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...(status && Object.values(AttendanceStatus).includes(status)
          ? { status: status as AttendanceStatus }
          : {}),
        ...(notes !== undefined ? { notes: notes ? notes.trim() : null } : {}),
        ...(term ? { term: term.trim() } : {}),
        ...(date ? { date: new Date(date + 'T00:00:00.000Z') } : {}),
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
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        academicYear: {
          select: {
            id: true,
            year: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance record updated successfully.',
      attendance: updated,
    });
  } catch (error: any) {
    console.error('Error updating attendance:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
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

    const existing = await prisma.attendance.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
    }

    await prisma.attendance.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Attendance record deleted successfully.',
    });
  } catch (error: any) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
