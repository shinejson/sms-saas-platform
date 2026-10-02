import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { InvoiceStatus } from '@prisma/client';
import { verifyTenantOwnership } from '@/lib/tenant-security';
import { sanitizeError } from '@/lib/errors';

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
    const existing = await verifyTenantOwnership<any>('payment', id, tenantId);
    
    // Fetch full details
    const fullPayment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            student: { include: { class: true } },
            academicYear: true,
          },
        },
      },
    });

    if (!fullPayment) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    const body = await req.json();
    const {
      amountPaid,
      paymentMethod,
      referenceNo,
      paymentDate,
      notes,
    } = body;

    let parsedAmount = Number(fullPayment.amount);
    if (amountPaid !== undefined) {
      parsedAmount = parseFloat(amountPaid);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: 'Amount paid must be greater than 0.' }, { status: 400 });
      }
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          amount: parsedAmount,
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(referenceNo !== undefined ? { transactionRef: referenceNo.trim() || null } : {}),
          ...(notes !== undefined ? { notes: notes.trim() || null } : {}),
          ...(paymentDate ? { createdAt: new Date(`${paymentDate}T12:00:00.000Z`) } : {}),
        },
        include: {
          invoice: {
            include: {
              student: { include: { class: true } },
              academicYear: true,
            },
          },
          recordedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      // Recalculate invoice
      const allPayments = await tx.payment.findMany({
        where: { invoiceId: fullPayment.invoiceId, tenantId },
        select: { amount: true },
      });

      const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const invoiceTotal = Number(fullPayment.invoice.totalAmount);
      const newBalance = Math.max(0, invoiceTotal - totalPaid);

      let newStatus: InvoiceStatus = InvoiceStatus.UNPAID;
      if (newBalance <= 0 && invoiceTotal > 0) {
        newStatus = InvoiceStatus.PAID;
      } else if (totalPaid > 0) {
        newStatus = InvoiceStatus.PARTIAL;
      }

      await tx.invoice.update({
        where: { id: existing.invoiceId },
        data: {
          paidAmount: totalPaid,
          balance: newBalance,
          status: newStatus,
        },
      });

      return {
        payment: updatedPayment,
        newBalance,
        totalPaid,
        newStatus,
      };
    });

    const payment = result.payment;
    const invoice = payment.invoice;
    const student = invoice.student;

    let balanceStatus: 'Paid' | 'Part Payment' | 'No Payment' = 'No Payment';
    if (result.newStatus === InvoiceStatus.PAID || result.newBalance <= 0) {
      balanceStatus = 'Paid';
    } else if (result.totalPaid > 0) {
      balanceStatus = 'Part Payment';
    }

    let categoryName = 'School Fees';
    if (invoice.itemsJson && typeof invoice.itemsJson === 'object') {
      const meta = invoice.itemsJson as any;
      if (meta.category) {
        categoryName = meta.category;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment updated successfully.',
      payment: {
        id: payment.id,
        transactionId: payment.receiptNumber,
        receiptNumber: payment.receiptNumber,
        invoiceId: payment.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        categoryName,
        studentDbId: student.id,
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        studentClass: student.class?.name || 'Unassigned',
        studentClassId: student.classId || '',
        academicYear: invoice.academicYear?.year || '',
        academicYearId: invoice.academicYearId,
        term: invoice.term,
        paymentDate: payment.createdAt.toISOString().split('T')[0],
        amountPaid: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        referenceNo: payment.transactionRef || '',
        notes: payment.notes || '',
        balance: result.newBalance,
        invoiceTotal: Number(invoice.totalAmount),
        invoicePaid: result.totalPaid,
        balanceStatus,
        recordedBy: payment.recordedBy?.fullName || session.fullName || 'Administrator',
        createdAt: payment.createdAt.toISOString(),
      },
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
    const existing = await verifyTenantOwnership<any>('payment', id, tenantId);
    
    // Fetch invoice details
    const fullPayment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    });

    if (!fullPayment) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Delete payment
      await tx.payment.delete({
        where: { id },
      });

      // Recalculate invoice balances
      const remainingPayments = await tx.payment.findMany({
        where: { invoiceId: fullPayment.invoiceId, tenantId },
        select: { amount: true },
      });

      const totalPaid = remainingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const invoiceTotal = Number(fullPayment.invoice.totalAmount);
      const newBalance = Math.max(0, invoiceTotal - totalPaid);

      let newStatus: InvoiceStatus = InvoiceStatus.UNPAID;
      if (newBalance <= 0 && invoiceTotal > 0) {
        newStatus = InvoiceStatus.PAID;
      } else if (totalPaid > 0) {
        newStatus = InvoiceStatus.PARTIAL;
      }

      await tx.invoice.update({
        where: { id: fullPayment.invoiceId },
        data: {
          paidAmount: totalPaid,
          balance: newBalance,
          status: newStatus,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Payment ${existing.receiptNumber} deleted and invoice balance recalculated.`,
    });
  } catch (error: any) {
    const sanitized = sanitizeError(error, process.env.NODE_ENV === 'development');
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.statusCode });
  }
}
