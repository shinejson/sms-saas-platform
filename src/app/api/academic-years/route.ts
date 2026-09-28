import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getClientIp, logAuditEvent } from '@/lib/audit';

export const ACADEMIC_YEAR_TERMS = ['Term 1', 'Term 2', 'Term 3'] as const;

type AcademicYearStatus = 'Active' | 'Inactive';

function normalizeStatus(value: unknown): AcademicYearStatus {
  return String(value ?? '').trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

function normalizeTerm(value: unknown): { currentTerm: string; error?: string } {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { currentTerm: 'Term 1' };
  }
  const currentTerm = String(value).trim();
  if (!ACADEMIC_YEAR_TERMS.includes(currentTerm as (typeof ACADEMIC_YEAR_TERMS)[number])) {
    return { currentTerm: 'Term 1', error: `Current term must be one of: ${ACADEMIC_YEAR_TERMS.join(', ')}.` };
  }
  return { currentTerm };
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

    const academicYears = await prisma.academicYear.findMany({
      where: {
        tenantId: session.tenantId,
        ...(statusFilter === 'active' || statusFilter === 'inactive'
          ? { status: statusFilter === 'inactive' ? 'Inactive' : 'Active' }
          : {}),
        ...(query ? { year: { contains: query, mode: 'insensitive' } } : {}),
      },
      include: {
        _count: { select: { classes: true, invoices: true, attendance: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, academicYears });
  } catch (error: any) {
    console.error('Error fetching academic years:', error);
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
    const { year, status, currentTerm } = body;

    if (!year || !String(year).trim()) {
      return NextResponse.json({ error: 'Academic year is required.' }, { status: 400 });
    }

    const parsedTerm = normalizeTerm(currentTerm);
    if (parsedTerm.error) {
      return NextResponse.json({ error: parsedTerm.error }, { status: 400 });
    }

    const academicYear = String(year).trim();
    const resolvedStatus = normalizeStatus(status);

    const duplicate = await prisma.academicYear.findFirst({
      where: { tenantId: session.tenantId, year: { equals: academicYear, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'This academic year already exists.' },
        { status: 409 }
      );
    }

    const newAcademicYear = await prisma.$transaction(async (tx) => {
      // Only one academic year can be Active per school - demote the previous one.
      if (resolvedStatus === 'Active') {
        await tx.academicYear.updateMany({
          where: { tenantId: session.tenantId, status: 'Active' },
          data: { status: 'Inactive' },
        });
      }

      return tx.academicYear.create({
        data: {
          tenantId: session.tenantId,
          year: academicYear,
          status: resolvedStatus,
          currentTerm: parsedTerm.currentTerm,
        },
      });
    });

    await logAuditEvent({
      tenantId: session.tenantId,
      userId: session.userId,
      action: 'Create',
      entity: 'AcademicYear',
      entityId: newAcademicYear.id,
      ipAddress: getClientIp(req),
      details: {
        academicYear: newAcademicYear.year,
        status: newAcademicYear.status,
        currentTerm: newAcademicYear.currentTerm,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Academic year added successfully!',
      academicYear: newAcademicYear,
    });
  } catch (error: any) {
    console.error('Error creating academic year:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This academic year already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
