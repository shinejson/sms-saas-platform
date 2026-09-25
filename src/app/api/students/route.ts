import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { verifyTenantStudentQuota } from '@/lib/tenant';

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

    const students = await prisma.student.findMany({
      where: {
        tenantId: session.tenantId,
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
                { studentId: { contains: query, mode: 'insensitive' } },
                { guardianName: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        class: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, students });
  } catch (error: any) {
    console.error('Error fetching students:', error);
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

    const quota = await verifyTenantStudentQuota(session.tenantId);
    if (!quota.canAdd) {
      return NextResponse.json(
        {
          error: `Student quota limit reached (${quota.currentCount}/${quota.limit}). Please upgrade your school plan to enroll more students.`,
          quota,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      gender,
      studentId,
      guardianName,
      guardianPhone,
      guardianEmail,
      address,
    } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required.' },
        { status: 400 }
      );
    }

    // Auto-generate student ID if not provided
    const genStudentId =
      studentId ||
      `STU-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`;

    const newStudent = await prisma.student.create({
      data: {
        tenantId: session.tenantId,
        studentId: genStudentId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender: gender || 'Not Specified',
        guardianName: guardianName ? guardianName.trim() : null,
        guardianPhone: guardianPhone ? guardianPhone.trim() : null,
        guardianEmail: guardianEmail ? guardianEmail.trim() : null,
        address: address ? address.trim() : null,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Student enrolled successfully!',
      student: newStudent,
    });
  } catch (error: any) {
    console.error('Error creating student:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A student with this Student ID already exists in your school.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
