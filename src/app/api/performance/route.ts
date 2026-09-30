import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// Helper: auto-generate next Performance ID matching GS format PRF-XXXX
async function generateNextPerformanceId(tenantId: string): Promise<string> {
  const records = await prisma.performance.findMany({
    where: { tenantId },
    select: { performanceId: true },
  });

  let maxIdNum = 1000;
  records.forEach(({ performanceId }) => {
    if (performanceId && (performanceId.startsWith('PRF-') || performanceId.startsWith('PERF-'))) {
      const numPart = performanceId.replace(/^[A-Z]+-/, '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  return `PRF-${maxIdNum + 1}`;
}

// Helper: Standard WAEC / GES 9-point grading scale matching Code.gs
function calculateGradeAndRemarks(totalScore: number): { grade: string; remarks: string } {
  if (totalScore >= 80) return { grade: '1', remarks: 'Highest' };
  if (totalScore >= 70) return { grade: '2', remarks: 'Higher' };
  if (totalScore >= 65) return { grade: '3', remarks: 'High' };
  if (totalScore >= 60) return { grade: '4', remarks: 'High Average' };
  if (totalScore >= 55) return { grade: '5', remarks: 'Average' };
  if (totalScore >= 50) return { grade: '6', remarks: 'Low Average' };
  if (totalScore >= 45) return { grade: '7', remarks: 'Low' };
  if (totalScore >= 40) return { grade: '8', remarks: 'Lower' };
  return { grade: '9', remarks: 'Lowest' };
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
    const studentClass = searchParams.get('class') || '';
    const academicYear = searchParams.get('academicYear') || '';
    const term = searchParams.get('term') || '';
    const course = searchParams.get('course') || '';

    const where: any = {
      tenantId: session.tenantId,
    };

    if (studentClass) {
      where.studentClass = studentClass;
    }
    if (academicYear) {
      where.academicYear = academicYear;
    }
    if (term) {
      where.term = term;
    }
    if (course) {
      where.course = { equals: course, mode: 'insensitive' };
    }
    if (query) {
      where.OR = [
        { studentName: { contains: query, mode: 'insensitive' } },
        { course: { contains: query, mode: 'insensitive' } },
        { performanceId: { contains: query, mode: 'insensitive' } },
        { studentClass: { contains: query, mode: 'insensitive' } },
        { student: { firstName: { contains: query, mode: 'insensitive' } } },
        { student: { lastName: { contains: query, mode: 'insensitive' } } },
        { student: { studentId: { contains: query, mode: 'insensitive' } } },
      ];
    }

    const performance = await prisma.performance.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    return NextResponse.json({ success: true, performance });
  } catch (error: any) {
    console.error('Error fetching performance records:', error);
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
    const { studentId, studentClass, term, academicYear, course, classScore, examScore100 } = body;

    if (!studentId || !term || !academicYear || !course) {
      return NextResponse.json(
        { error: 'Student, Subject/Course, Academic Year, and Term are required.' },
        { status: 400 }
      );
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId: session.tenantId },
      include: { class: { select: { name: true } } },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });
    }

    const trimmedCourse = course.trim();
    const trimmedTerm = term.trim();
    const trimmedYear = academicYear.trim();

    // Prevent duplicate entries for the same student, course, term, and year
    const existing = await prisma.performance.findFirst({
      where: {
        tenantId: session.tenantId,
        studentId,
        course: { equals: trimmedCourse, mode: 'insensitive' },
        term: trimmedTerm,
        academicYear: trimmedYear,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `A performance record for ${student.firstName} ${student.lastName} in "${trimmedCourse}" for ${trimmedTerm} (${trimmedYear}) already exists.`,
        },
        { status: 409 }
      );
    }

    const rawClassScore = parseFloat(classScore);
    const rawExamScore = parseFloat(examScore100);

    const cScore = isNaN(rawClassScore) ? 0 : Math.min(Math.max(rawClassScore, 0), 50);
    const e100 = isNaN(rawExamScore) ? 0 : Math.min(Math.max(rawExamScore, 0), 100);
    const e50 = Math.round(e100 * 0.5 * 10) / 10;
    const total = Math.round((cScore + e50) * 10) / 10;
    const { grade, remarks } = calculateGradeAndRemarks(total);

    const performanceId = await generateNextPerformanceId(session.tenantId);
    const resolvedClass = studentClass?.trim() || student.class?.name || 'Unassigned';

    const newRecord = await prisma.performance.create({
      data: {
        tenantId: session.tenantId,
        performanceId,
        studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        studentClass: resolvedClass,
        term: trimmedTerm,
        academicYear: trimmedYear,
        course: trimmedCourse,
        classScore: cScore,
        examScore100: e100,
        examScore60: e50, // stores 50% weighted exam score
        total,
        grade,
        remarks,
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
      message: `Performance record ${performanceId} for ${newRecord.studentName} created successfully!`,
      performance: newRecord,
    });
  } catch (error: any) {
    console.error('Error creating performance record:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
