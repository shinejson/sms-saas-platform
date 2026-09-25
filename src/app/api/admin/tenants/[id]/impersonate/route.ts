import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, generateToken } from '@/lib/auth';

export async function POST(
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
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Super Admin access required.' }, { status: 403 });
    }

    const { id: tenantId } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'School tenant not found' }, { status: 404 });
    }

    // Generate an authorized session token for this school tenant
    const impersonateToken = generateToken(
      {
        userId: session.userId,
        tenantId: tenant.id,
        email: session.email,
        fullName: `${session.fullName} (Platform Owner)`,
        role: 'SUPER_ADMIN',
        subdomain: tenant.subdomain,
      },
      '4h'
    );

    return NextResponse.json({
      success: true,
      message: `Impersonation session created for ${tenant.name}`,
      token: impersonateToken,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        alias: tenant.alias,
        subdomain: tenant.subdomain,
        plan: tenant.plan,
        currency: tenant.currency,
        studentLimit: tenant.studentLimit,
      },
      user: {
        id: session.userId,
        fullName: `${session.fullName} (Platform Owner)`,
        email: session.email,
        role: 'SUPER_ADMIN',
      },
    });
  } catch (error: any) {
    console.error('Impersonation error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
