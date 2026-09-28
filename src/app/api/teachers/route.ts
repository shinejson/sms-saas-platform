import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// Helper: auto-generate next Teacher ID matching GS format TCH-XXXX
async function generateNextTeacherId(tenantId: string): Promise<string> {
  const teachers = await prisma.teacher.findMany({
    where: { tenantId },
    select: { teacherId: true },
  });

  let maxIdNum = 1000;
  teachers.forEach(({ teacherId }) => {
    if (teacherId.startsWith('TCH-')) {
      const num = parseInt(teacherId.substring(4), 10);
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  return `TCH-${maxIdNum + 1}`;
}

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

    const teachers = await prisma.teacher.findMany({
      where: {
        tenantId: session.tenantId,
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
                { teacherId: { contains: query, mode: 'insensitive' } },
                { className: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, teachers });
  } catch (error: any) {
    console.error('Error fetching teachers:', error);
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
    const { firstName, lastName, className, academicYear } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required.' },
        { status: 400 }
      );
    }

    const teacherId = await generateNextTeacherId(session.tenantId);

    const newTeacher = await prisma.teacher.create({
      data: {
        tenantId: session.tenantId,
        teacherId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        className: className ? className.trim() : null,
        academicYear: academicYear ? academicYear.trim() : null,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Teacher added successfully!',
      teacher: newTeacher,
      teacherId,
    });
  } catch (error: any) {
    console.error('Error creating teacher:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A teacher with this ID already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
