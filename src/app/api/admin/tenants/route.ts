import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.toLowerCase().trim() || '';
    const plan = searchParams.get('plan')?.toUpperCase();
    const status = searchParams.get('status')?.toUpperCase();

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { subdomain: { contains: q, mode: 'insensitive' } },
        { alias: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (plan && plan !== 'ALL') {
      where.plan = plan;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        alias: true,
        subdomain: true,
        currency: true,
        plan: true,
        studentLimit: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            students: true,
            users: true,
            classes: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, tenants });
  } catch (error: any) {
    console.error('Error fetching admin tenants:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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

    const body = await req.json();
    const { id, plan, studentLimit, status, name, alias } = body;

    if (!id) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const data: any = {};
    if (plan) data.plan = plan;
    if (typeof studentLimit === 'number') data.studentLimit = studentLimit;
    if (status) data.status = status;
    if (name) data.name = name;
    if (alias) data.alias = alias;

    const updated = await prisma.tenant.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        alias: true,
        subdomain: true,
        currency: true,
        plan: true,
        studentLimit: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'School tenant updated successfully',
      tenant: updated,
    });
  } catch (error: any) {
    console.error('Error updating tenant:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
