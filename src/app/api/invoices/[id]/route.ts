import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { InvoiceStatus } from '@prisma/client';
import { verifyTenantOwnership } from '@/lib/tenant-security';
import { sanitizeError } from '@/lib/errors';

function calculateInvoiceStatus(totalAmount: number, paidAmount: number): InvoiceStatus {
  const balance = Math.max(0, totalAmount - paidAmount);
  if (balance <= 0 && totalAmount > 0) {
    return InvoiceStatus.PAID;
  }
  if (paidAmount > 0 && balance > 0) {
    return InvoiceStatus.PARTIAL;
  }
  return InvoiceStatus.UNPAID;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired or invalid.' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // Verify tenant ownership - throws if not found or wrong tenant
    const existing = await verifyTenantOwnership('invoice', id, tenantId);

    const body = await req.json();
    const {
      category,
      items,
      totalAmount,
      paidAmount,
      dueDate,
      issueDate,
      term,
      academicYearId,
      status: explicitStatus,
    } = body;

    const parsedTotal = totalAmount !== undefined ? parseFloat(totalAmount) : Number(existing.totalAmount);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return NextResponse.json({ error: 'Total amount must be greater than 0.' }, { status: 400 });
    }

    const parsedPaid = paidAmount !== undefined ? parseFloat(paidAmount) : Number(existing.paidAmount);
    if (isNaN(parsedPaid) || parsedPaid < 0) {
      return NextResponse.json({ error: 'Paid amount cannot be negative.' }, { status: 400 });
    }

    const balance = Math.max(0, parsedTotal - parsedPaid);

    let status: InvoiceStatus = calculateInvoiceStatus(parsedTotal, parsedPaid);
    if (explicitStatus === InvoiceStatus.CANCELLED) {
      status = InvoiceStatus.CANCELLED;
    }

    const existingMeta = (existing.itemsJson as any) || {};
    const updatedMeta = {
      ...existingMeta,
      category: category !== undefined ? category : existingMeta.category,
      items: items !== undefined ? items : existingMeta.items,
      issueDate: issueDate !== undefined ? issueDate : existingMeta.issueDate,
    };

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        totalAmount: parsedTotal,
        paidAmount: parsedPaid,
        balance,
        status,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
        term: term || existing.term,
        academicYearId: academicYearId || existing.academicYearId,
        itemsJson: updatedMeta,
      },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            class: { select: { id: true, name: true } },
          },
        },
        academicYear: {
          select: { id: true, year: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        ...updated,
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
        balance: Number(updated.balance),
        category: updatedMeta.category,
        items: updatedMeta.items,
        issueDate: updatedMeta.issueDate,
      },
      message: `Invoice ${updated.invoiceNumber} updated successfully.`,
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
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired or invalid.' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // Verify tenant ownership - throws if not found or wrong tenant
    const existing = await verifyTenantOwnership('invoice', id, tenantId);

    await prisma.invoice.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Invoice ${existing.invoiceNumber} deleted successfully.`,
    });
  } catch (error: any) {
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}
