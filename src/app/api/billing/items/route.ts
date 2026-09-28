import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.billing.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('Error fetching billing items:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { item, amount, status, description } = await req.json();

    if (!item) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    // Auto-generate next Billing ID (e.g. BIL-1001, BIL-1002...)
    const existing = await prisma.billing.findMany({
      where: { tenantId: session.tenantId },
      select: { billingId: true },
    });

    let maxNum = 1000;
    for (const b of existing) {
      if (b.billingId && b.billingId.startsWith('BIL-')) {
        const num = parseInt(b.billingId.replace('BIL-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    const billingId = `BIL-${maxNum + 1}`;

    const newBilling = await prisma.billing.create({
      data: {
        tenantId: session.tenantId,
        billingId,
        item: String(item).trim(),
        amount: Number(amount) || 0,
        status: status || 'Active',
        description: description ? String(description).trim() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Billing item created successfully',
      item: newBilling,
    });
  } catch (error: any) {
    console.error('Error creating billing item:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    await prisma.billing.deleteMany({
      where: {
        tenantId: session.tenantId,
        id,
      },
    });

    return NextResponse.json({ success: true, message: 'Billing item deleted' });
  } catch (error: any) {
    console.error('Error deleting billing item:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
