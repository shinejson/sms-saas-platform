import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { AttendanceStatus } from '@prisma/client';

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
    const dateParam = searchParams.get('date') || '';
    const classId = searchParams.get('classId') || '';
    const academicYearId = searchParams.get('academicYearId') || '';
    const term = searchParams.get('term') || '';
    const statusParam = searchParams.get('status') || '';

    const where: any = {
      tenantId: session.tenantId,
    };

    if (classId) {
      where.classId = classId;
    }
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    if (term) {
      where.term = term;
    }
    if (statusParam && Object.values(AttendanceStatus).includes(statusParam as AttendanceStatus)) {
      where.status = statusParam as AttendanceStatus;
    }
    if (dateParam) {
      const startOfDay = new Date(dateParam + 'T00:00:00.000Z');
      const endOfDay = new Date(dateParam + 'T23:59:59.999Z');
      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }
    if (query) {
      where.OR = [
        { student: { firstName: { contains: query, mode: 'insensitive' } } },
        { student: { lastName: { contains: query, mode: 'insensitive' } } },
        { student: { studentId: { contains: query, mode: 'insensitive' } } },
        { class: { name: { contains: query, mode: 'insensitive' } } },
        { notes: { contains: query, mode: 'insensitive' } },
      ];
    }

    const attendance = await prisma.attendance.findMany({
      where,
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
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });

    return NextResponse.json({ success: true, attendance });
  } catch (error: any) {
    console.error('Error fetching attendance:', error);
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
    const { bulk, records, studentId, classId, academicYearId, term, date, status, notes } = body;

    if (!date) {
      return NextResponse.json({ error: 'A valid attendance date is required.' }, { status: 400 });
    }

    const targetDate = new Date(date + 'T00:00:00.000Z');

    // Bulk class roll call
    if (bulk && Array.isArray(records)) {
      if (!classId || !academicYearId || !term) {
        return NextResponse.json(
          { error: 'Class, Academic Year, and Term are required for bulk attendance.' },
          { status: 400 }
        );
      }

      if (records.length === 0) {
        return NextResponse.json(
          { error: 'No student records provided for attendance.' },
          { status: 400 }
        );
      }

      const upsertOps = records.map((rec: any) => {
        const validStatus: AttendanceStatus = Object.values(AttendanceStatus).includes(rec.status)
          ? (rec.status as AttendanceStatus)
          : AttendanceStatus.PRESENT;

        return prisma.attendance.upsert({
          where: {
            tenantId_studentId_date: {
              tenantId: session.tenantId,
              studentId: rec.studentId,
              date: targetDate,
            },
          },
          create: {
            tenantId: session.tenantId,
            studentId: rec.studentId,
            classId,
            academicYearId,
            term: term.trim(),
            date: targetDate,
            status: validStatus,
            notes: rec.notes?.trim() || null,
          },
          update: {
            classId,
            academicYearId,
            term: term.trim(),
            status: validStatus,
            notes: rec.notes !== undefined ? (rec.notes?.trim() || null) : undefined,
          },
        });
      });

      const results = await prisma.$transaction(upsertOps);

      return NextResponse.json({
        success: true,
        message: `Successfully marked attendance for ${results.length} students!`,
        count: results.length,
      });
    }

    // Single student attendance record
    if (!studentId || !classId || !academicYearId || !term) {
      return NextResponse.json(
        { error: 'Student, Class, Academic Year, and Term are required.' },
        { status: 400 }
      );
    }

    const validStatus: AttendanceStatus = Object.values(AttendanceStatus).includes(status)
      ? (status as AttendanceStatus)
      : AttendanceStatus.PRESENT;

    const result = await prisma.attendance.upsert({
      where: {
        tenantId_studentId_date: {
          tenantId: session.tenantId,
          studentId,
          date: targetDate,
        },
      },
      create: {
        tenantId: session.tenantId,
        studentId,
        classId,
        academicYearId,
        term: term.trim(),
        date: targetDate,
        status: validStatus,
        notes: notes?.trim() || null,
      },
      update: {
        classId,
        academicYearId,
        term: term.trim(),
        status: validStatus,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
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
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance recorded successfully!',
      attendance: result,
    });
  } catch (error: any) {
    console.error('Error saving attendance:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
