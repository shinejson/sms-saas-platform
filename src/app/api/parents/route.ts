import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// Helper: auto-generate next Mapping ID matching GS format PAR-XXXX
async function generateNextParentId(tenantId: string): Promise<string> {
  const parents = await prisma.parent.findMany({
    where: { tenantId },
    select: { mappingId: true },
  });

  let maxIdNum = 1000;
  parents.forEach(({ mappingId }) => {
    if (mappingId && mappingId.startsWith('PAR-')) {
      const num = parseInt(mappingId.substring(4), 10);
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  return `PAR-${maxIdNum + 1}`;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    const parents = await prisma.parent.findMany({
      where: {
        tenantId: session.tenantId,
        ...(query
          ? {
              OR: [
                { parentName: { contains: query, mode: 'insensitive' } },
                { mappingId: { contains: query, mode: 'insensitive' } },
                { relationship: { contains: query, mode: 'insensitive' } },
                { student: { firstName: { contains: query, mode: 'insensitive' } } },
                { student: { lastName: { contains: query, mode: 'insensitive' } } },
                { student: { studentId: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : {}),
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
        parentUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, parents });
  } catch (error: any) {
    console.error('Error fetching parent mappings:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const body = await req.json();
    const { parentName, studentId, relationship, isPrimary, billing, parentUserId, phone, email } = body;

    if (!parentName || !studentId) {
      return NextResponse.json(
        { error: 'Parent name and student are required.' },
        { status: 400 }
      );
    }

    // Resolve student
    const student = await prisma.student.findFirst({
      where: {
        tenantId: session.tenantId,
        OR: [
          { id: studentId },
          { studentId: studentId },
        ],
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Selected student not found in this school.' },
        { status: 404 }
      );
    }

    // Auto-generate mapping ID
    const mappingId = await generateNextParentId(session.tenantId);

    const newParent = await prisma.parent.create({
      data: {
        tenantId: session.tenantId,
        mappingId,
        parentName: parentName.trim(),
        studentId: student.id,
        relationship: relationship ? relationship.trim() : 'Guardian',
        isPrimary: Boolean(isPrimary),
        billing: billing ? String(billing).trim() : 'No',
        parentUserId: parentUserId || null,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
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
      message: 'Parent mapping created successfully.',
      parent: newParent,
      mappingId,
    });
  } catch (error: any) {
    console.error('Error creating parent mapping:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
