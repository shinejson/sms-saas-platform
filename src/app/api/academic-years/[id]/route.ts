import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getClientIp, logAuditEvent } from '@/lib/audit';
import { verifyTenantOwnership } from '@/lib/tenant-security';
import { sanitizeError } from '@/lib/errors';

type AcademicYearStatus = 'Active' | 'Inactive';

const ACADEMIC_YEAR_TERMS = ['Term 1', 'Term 2', 'Term 3'];

function normalizeStatus(value: unknown): AcademicYearStatus {
  return String(value ?? '').trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

function normalizeTerm(value: unknown): { currentTerm: string; error?: string } {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { currentTerm: 'Term 1' };
  }
  const currentTerm = String(value).trim();
  if (!ACADEMIC_YEAR_TERMS.includes(currentTerm)) {
    return { currentTerm: 'Term 1', error: `Current term must be one of: ${ACADEMIC_YEAR_TERMS.join(', ')}.` };
  }
  return { currentTerm };
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
    const { year, status, currentTerm } = body;

    if (!year || !String(year).trim()) {
      return NextResponse.json({ error: 'Academic year is required.' }, { status: 400 });
    }

    const parsedTerm = normalizeTerm(currentTerm);
    if (parsedTerm.error) {
      return NextResponse.json({ error: parsedTerm.error }, { status: 400 });
    }

    // Verify the academic year belongs to this tenant
    const existing = await verifyTenantOwnership('academicYear', id, session.tenantId);

    const academicYear = String(year).trim();
    const resolvedStatus = normalizeStatus(status);

    const duplicate = await prisma.academicYear.findFirst({
      where: {
        tenantId: session.tenantId,
        id: { not: id },
        year: { equals: academicYear, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'This academic year already exists.' },
        { status: 409 }
      );
    }

    const updatedAcademicYear = await prisma.$transaction(async (tx) => {
      // Only one academic year can be Active per school - demote the others.
      if (resolvedStatus === 'Active') {
        await tx.academicYear.updateMany({
          where: { tenantId: session.tenantId, id: { not: id }, status: 'Active' },
          data: { status: 'Inactive' },
        });
      }

      return tx.academicYear.update({
        where: { id },
        data: {
          year: academicYear,
          status: resolvedStatus,
          currentTerm: parsedTerm.currentTerm,
        },
      });
    });

    await logAuditEvent({
      tenantId: session.tenantId,
      userId: session.userId,
      action: 'Update',
      entity: 'AcademicYear',
      entityId: updatedAcademicYear.id,
      ipAddress: getClientIp(req),
      details: {
        before: {
          academicYear: existing.year,
          status: existing.status,
          currentTerm: existing.currentTerm,
        },
        after: {
          academicYear: updatedAcademicYear.year,
          status: updatedAcademicYear.status,
          currentTerm: updatedAcademicYear.currentTerm,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Academic year updated successfully!',
      academicYear: updatedAcademicYear,
    });
  } catch (error: any) {
    if ((error as any).code === 'P2002') {
      return NextResponse.json({ error: 'This academic year already exists.' }, { status: 409 });
    }
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

    // Verify the academic year belongs to this tenant
    const existing = await verifyTenantOwnership('academicYear', id, session.tenantId);

    // Invoices cascade on delete, so refuse while the session is still in use.
    const [classCount, invoiceCount, attendanceCount] = await Promise.all([
      prisma.class.count({ where: { academicYearId: id, tenantId: session.tenantId } }),
      prisma.invoice.count({ where: { academicYearId: id, tenantId: session.tenantId } }),
      prisma.attendance.count({ where: { academicYearId: id, tenantId: session.tenantId } }),
    ]);

    if (classCount > 0 || invoiceCount > 0 || attendanceCount > 0) {
      const blockers: string[] = [];
      if (classCount > 0) blockers.push(`${classCount} class(es)`);
      if (invoiceCount > 0) blockers.push(`${invoiceCount} invoice(s)`);
      if (attendanceCount > 0) blockers.push(`${attendanceCount} attendance record(s)`);
      return NextResponse.json(
        {
          error: `Cannot delete ${existing.year}: it is still linked to ${blockers.join(', ')}. Reassign or remove them first.`,
        },
        { status: 409 }
      );
    }

    await prisma.academicYear.delete({ where: { id } });

    await logAuditEvent({
      tenantId: session.tenantId,
      userId: session.userId,
      action: 'Delete',
      entity: 'AcademicYear',
      entityId: id,
      ipAddress: getClientIp(req),
      details: {
        academicYear: existing.year,
        status: existing.status,
        currentTerm: existing.currentTerm,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Academic year deleted successfully!',
    });
  } catch (error: any) {
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}

