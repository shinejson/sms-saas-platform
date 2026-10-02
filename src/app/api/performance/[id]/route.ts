import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { verifyTenantOwnership } from '@/lib/tenant-security';
import { sanitizeError } from '@/lib/errors';

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
    const { course, term, academicYear, studentClass, classScore, examScore100 } = body;

    const existing = await verifyTenantOwnership('performance', id, session.tenantId);

    const targetCourse = course !== undefined ? course.trim() : existing.course;
    const targetTerm = term !== undefined ? term.trim() : existing.term;
    const targetYear = academicYear !== undefined ? academicYear.trim() : existing.academicYear;

    // Check duplicate excluding this record
    const duplicate = await prisma.performance.findFirst({
      where: {
        tenantId: session.tenantId,
        studentId: existing.studentId,
        course: { equals: targetCourse, mode: 'insensitive' },
        term: targetTerm,
        academicYear: targetYear,
        NOT: { id },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          error: `Another performance record for this student in "${targetCourse}" for ${targetTerm} (${targetYear}) already exists.`,
        },
        { status: 409 }
      );
    }

    const rawClassScore = classScore !== undefined ? parseFloat(classScore) : Number(existing.classScore);
    const rawExamScore = examScore100 !== undefined ? parseFloat(examScore100) : Number(existing.examScore100);

    const cScore = isNaN(rawClassScore) ? 0 : Math.min(Math.max(rawClassScore, 0), 50);
    const e100 = isNaN(rawExamScore) ? 0 : Math.min(Math.max(rawExamScore, 0), 100);
    const e50 = Math.round(e100 * 0.5 * 10) / 10;
    const total = Math.round((cScore + e50) * 10) / 10;
    const { grade, remarks } = calculateGradeAndRemarks(total);

    const updated = await prisma.performance.update({
      where: { id },
      data: {
        course: targetCourse,
        term: targetTerm,
        academicYear: targetYear,
        studentClass: studentClass !== undefined ? (studentClass?.trim() || null) : existing.studentClass,
        classScore: cScore,
        examScore100: e100,
        examScore60: e50,
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
      message: `Performance record ${updated.performanceId || ''} updated successfully.`,
      performance: updated,
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

    const existing = await verifyTenantOwnership('performance', id, session.tenantId);

    await prisma.performance.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Performance record ${existing.performanceId || ''} deleted successfully.`,
    });
  } catch (error: any) {
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}
