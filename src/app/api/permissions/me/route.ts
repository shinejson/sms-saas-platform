import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { isAdminRole, parsePermPolicy } from '@/lib/permissions';

/**
 * Returns the effective permission policy for the CURRENTLY authenticated
 * user. The dashboard uses this to decide which sidebar pages the user can
 * see and which actions (create/edit/delete) they may perform.
 *
 * Response:
 *   {
 *     role: 'BURSAR',
 *     isAdmin: false,
 *     roleHasPolicy: true,          // a Permission record exists for this role
 *     policy: { students: ['view'] } // null when no policy -> full access
 *   }
 */
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

    const record = await prisma.permission.findFirst({
      where: {
        tenantId: session.tenantId,
        role: { equals: session.role, mode: 'insensitive' },
      },
    });

    const policy = record ? parsePermPolicy(record.actions) : null;

    return NextResponse.json({
      success: true,
      role: session.role,
      isAdmin: isAdminRole(session.role),
      // true when a policy record exists for this role (even an empty/legacy one)
      roleHasPolicy: !!record,
      // null => no restrictive policy, the user keeps full access
      policy,
    });
  } catch (error: any) {
    console.error('Error fetching effective permissions:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
