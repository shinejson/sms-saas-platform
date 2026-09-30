import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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
    const { role, accessLevel, actions } = body;

    if (!role || !accessLevel || !actions) {
      return NextResponse.json(
        { error: 'Role name, access level, and permitted actions are required.' },
        { status: 400 }
      );
    }

    // Verify permission belongs to current tenant
    const existing = await prisma.permission.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Permission not found.' }, { status: 404 });
    }

    const cleanRole = role.trim();

    // Check duplicate role in tenant if role name changed
    if (existing.role.toLowerCase() !== cleanRole.toLowerCase()) {
      const duplicate = await prisma.permission.findFirst({
        where: {
          tenantId: session.tenantId,
          role: { equals: cleanRole, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `Another permission role named "${cleanRole}" already exists.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.permission.update({
      where: { id },
      data: {
        role: cleanRole,
        accessLevel: accessLevel.trim(),
        actions: actions.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Permission updated successfully.',
      permission: updated,
    });
  } catch (error: any) {
    console.error('Error updating permission:', error);
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

    // Verify permission belongs to current tenant
    const existing = await prisma.permission.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Permission not found.' }, { status: 404 });
    }

    // Core admin protection
    const protectedRoles = ['admin', 'school admin', 'super admin'];
    if (protectedRoles.includes(existing.role.trim().toLowerCase())) {
      return NextResponse.json(
        { error: `Cannot delete the core "${existing.role}" permission policy.` },
        { status: 400 }
      );
    }

    await prisma.permission.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Permission deleted successfully.',
    });
  } catch (error: any) {
    console.error('Error deleting permission:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
