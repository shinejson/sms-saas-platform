import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getClientIp, logAuditEvent } from '@/lib/audit';

type SubjectStatus = 'ACTIVE' | 'INACTIVE';

function normalizeStatus(value: unknown): SubjectStatus {
  return String(value ?? '').trim().toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE';
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
    const { name, instructor, credits, semester, status } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Subject name is required.' }, { status: 400 });
    }

    const parsedCredits = parseCredits(credits);
    if (parsedCredits.error) {
      return NextResponse.json({ error: parsedCredits.error }, { status: 400 });
    }

    // Verify the subject belongs to this tenant
    const existing = await prisma.subject.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });
    }

    const subjectName = String(name).trim();

    const duplicate = await prisma.subject.findFirst({
      where: {
        tenantId: session.tenantId,
        id: { not: id },
        name: { equals: subjectName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'A subject with this name already exists.' },
        { status: 409 }
      );
    }

    const updatedSubject = await prisma.subject.update({
      where: { id },
      data: {
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
      action: 'Update',
      entity: 'Subject',
      entityId: updatedSubject.id,
      ipAddress: getClientIp(req),
      details: {
        before: {
          code: existing.code,
          name: existing.name,
          instructor: existing.instructorName,
          credits: existing.credits,
          semester: existing.semester,
          status: existing.status,
        },
        after: {
          code: updatedSubject.code,
          name: updatedSubject.name,
          instructor: updatedSubject.instructorName,
          credits: updatedSubject.credits,
          semester: updatedSubject.semester,
          status: updatedSubject.status,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subject updated successfully!',
      subject: updatedSubject,
    });
  } catch (error: any) {
    console.error('Error updating subject:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A subject with this name already exists.' },
        { status: 409 }
      );
    }
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

    // Verify the subject belongs to this tenant
    const existing = await prisma.subject.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });
    }

    // Enrollment.subjectId is ON DELETE SET NULL, so count the links that will be unlinked
    const enrollmentCount = await prisma.enrollment.count({
      where: { subjectId: id, tenantId: session.tenantId },
    });

    await prisma.subject.delete({ where: { id } });

    await logAuditEvent({
      tenantId: session.tenantId,
      userId: session.userId,
      action: 'Delete',
      entity: 'Subject',
      entityId: id,
      ipAddress: getClientIp(req),
      details: {
        code: existing.code,
        name: existing.name,
        instructor: existing.instructorName,
        credits: existing.credits,
        semester: existing.semester,
        status: existing.status,
        unlinkedEnrollments: enrollmentCount,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        enrollmentCount > 0
          ? `Subject deleted successfully. ${enrollmentCount} enrollment(s) were unlinked.`
          : 'Subject deleted successfully!',
      unlinkedEnrollments: enrollmentCount,
    });
  } catch (error: any) {
    console.error('Error deleting subject:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

