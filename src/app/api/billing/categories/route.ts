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

    const categories = await prisma.billingCategory.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    console.error('Error fetching billing categories:', error);
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

    const { name, academicYear, term, items, totalAmount, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Category name is required (e.g. Primary, JHS, Nursery)' }, { status: 400 });
    }

    // Auto-generate next Category ID (e.g. BC-1001, BC-1002...)
    const existing = await prisma.billingCategory.findMany({
      where: { tenantId: session.tenantId },
      select: { categoryId: true },
    });

    let maxNum = 1000;
    for (const c of existing) {
      if (c.categoryId && c.categoryId.startsWith('BC-')) {
        const num = parseInt(c.categoryId.replace('BC-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    const categoryId = `BC-${maxNum + 1}`;

    const itemsStr = Array.isArray(items) ? items.join(', ') : String(items || '');

    const newCategory = await prisma.billingCategory.create({
      data: {
        tenantId: session.tenantId,
        categoryId,
        name: String(name).trim(),
        academicYear: academicYear ? String(academicYear).trim() : null,
        term: term ? String(term).trim() : null,
        items: itemsStr,
        totalAmount: Number(totalAmount) || 0,
        defaultAmount: Number(totalAmount) || 0,
        description: description ? String(description).trim() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Billing category created successfully',
      category: newCategory,
    });
  } catch (error: any) {
    console.error('Error creating billing category:', error);
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
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    await prisma.billingCategory.deleteMany({
      where: {
        tenantId: session.tenantId,
        id,
      },
    });

    return NextResponse.json({ success: true, message: 'Billing category deleted' });
  } catch (error: any) {
    console.error('Error deleting billing category:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
