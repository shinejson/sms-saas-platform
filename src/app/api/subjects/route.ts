import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getClientIp, logAuditEvent } from '@/lib/audit';

type SubjectStatus = 'ACTIVE' | 'INACTIVE';

/** GAS "Active" / "Inactive" -> Prisma AccountStatus enum */
function normalizeStatus(value: unknown): SubjectStatus {
  return String(value ?? '').trim().toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE';
}

// Helper: auto-generate next Subject code matching the GAS CRS-XXXX format
async function generateNextSubjectCode(tenantId: string): Promise<string> {
  const subjects = await prisma.subject.findMany({
    where: { tenantId },
    select: { code: true },
  });

  let maxNum = 1000;
  subjects.forEach(({ code }) => {
    if (code && code.startsWith('CRS-')) {
      const num = parseInt(code.substring(4), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `CRS-${maxNum + 1}`;
}

function parseCredits(value: unknown): { credits?: number; error?: string } {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { credits: 1 };
  }
  const credits = Number(value);
  if (!Number.isInteger(credits) || credits < 1 || credits > 99) {
    return { error: 'Credits must be a whole number between 1 and 99.' };
  }
  return { credits };
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
    const query = (searchParams.get('q') || '').trim();
    const statusFilter = (searchParams.get('status') || '').trim().toLowerCase();

    const subjects = await prisma.subject.findMany({
      where: {
        tenantId: session.tenantId,
        ...(statusFilter === 'active' || statusFilter === 'inactive'
          ? { status: statusFilter === 'inactive' ? 'INACTIVE' : 'ACTIVE' }
          : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
                { instructorName: { contains: query, mode: 'insensitive' } },
                { semester: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { instructor: { select: { id: true, fullName: true } } },
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({ success: true, subjects });
  } catch (error: any) {
    console.error('Error fetching subjects:', error);
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
    const { name, instructor, credits, semester, status } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Subject name is required.' }, { status: 400 });
    }

    const parsedCredits = parseCredits(credits);
    if (parsedCredits.error) {
      return NextResponse.json({ error: parsedCredits.error }, { status: 400 });
    }

    const subjectName = String(name).trim();

    const duplicate = await prisma.subject.findFirst({
      where: { tenantId: session.tenantId, name: { equals: subjectName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'A subject with this name already exists.' },
        { status: 409 }
      );
    }

    const code = await generateNextSubjectCode(session.tenantId);

    const newSubject = await prisma.subject.create({
      data: {
        tenantId: session.tenantId,
        code,
        name: subjectName,
        instructorName: instructor ? String(instructor).trim() : null,
        credits: parsedCredits.credits,
        semester: semester ? String(semester).trim() : null,
        status: normalizeStatus(status),
      },
    });

    await logAuditEvent({
      tenantId: session.tenantId,
      userId: session.userId,
      action: 'Create',
      entity: 'Subject',
      entityId: newSubject.id,
      ipAddress: getClientIp(req),
      details: {
        code: newSubject.code,
        name: newSubject.name,
        instructor: newSubject.instructorName,
        credits: newSubject.credits,
        semester: newSubject.semester,
        status: newSubject.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subject added successfully!',
      subject: newSubject,
      code,
    });
  } catch (error: any) {
    console.error('Error creating subject:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A subject with this name already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
