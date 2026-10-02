import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { isAdminRole, validatePermActionsInput } from '@/lib/permissions';
import { verifyTenantOwnership } from '@/lib/tenant-security';
import { sanitizeError } from '@/lib/errors';

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

    // Only administrators may edit permission policies.
    if (!isAdminRole(session.role)) {
      return NextResponse.json(
        { error: 'Only School Administrators can manage permission policies.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { role, accessLevel, actions } = body;

    if (!role || !accessLevel) {
      return NextResponse.json(
        { error: 'Role name and access level are required.' },
        { status: 400 }
      );
    }

    const validated = validatePermActionsInput(actions);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // Verify permission belongs to current tenant
    const existing = await verifyTenantOwnership('permission', id, session.tenantId);

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
        actions: validated.actions,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Permission updated successfully.',
      permission: updated,
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
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    // Only administrators may delete permission policies.
    if (!isAdminRole(session.role)) {
      return NextResponse.json(
        { error: 'Only School Administrators can manage permission policies.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify permission belongs to current tenant
    const existing = await verifyTenantOwnership('permission', id, session.tenantId);

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
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}
