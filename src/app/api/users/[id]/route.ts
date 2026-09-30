import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, hashPassword } from '@/lib/auth';
import { Role, AccountStatus } from '@prisma/client';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const { email, fullName, username, password, role, status } = body;

    if (!email || !fullName) {
      return NextResponse.json(
        { error: 'Email and full name are required.' },
        { status: 400 }
      );
    }

    // Verify user exists and belongs to the current tenant
    const existing = await prisma.user.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      username: username ? username.trim() : null,
    };

    if (role && Object.values(Role).includes(role as Role)) {
      updateData.role = role as Role;
    }

    if (status && Object.values(AccountStatus).includes(status as AccountStatus)) {
      updateData.status = status as AccountStatus;
    }

    // Update password only if a non-empty string is passed
    if (password && typeof password === 'string' && password.trim().length > 0) {
      updateData.passwordHash = await hashPassword(password.trim());
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User updated successfully.',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A user with this email address already exists in this school.' },
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
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const { id } = await params;

    // Safety guard: cannot delete yourself
    if (id === session.userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own logged-in user account.' },
        { status: 400 }
      );
    }

    // Verify user exists and belongs to this tenant
    const targetUser = await prisma.user.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Safety guard: cannot delete the last Admin user (matches GAS line 375)
    if (targetUser.role === Role.SCHOOL_ADMIN || targetUser.role === Role.SUPER_ADMIN) {
      const adminCount = await prisma.user.count({
        where: {
          tenantId: session.tenantId,
          role: { in: [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN] },
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error:
              'Cannot delete the last Admin user. You would lock yourself out of the system!',
          },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully.',
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
