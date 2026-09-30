import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { InvoiceStatus } from '@prisma/client';

async function generateNextPaymentId(tenantId: string): Promise<string> {
  const existing = await prisma.payment.findMany({
    where: { tenantId },
    select: { receiptNumber: true },
  });

  let maxNum = 1000;
  for (const pay of existing) {
    if (pay.receiptNumber && pay.receiptNumber.startsWith('PAY-')) {
      const num = parseInt(pay.receiptNumber.replace('PAY-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `PAY-${maxNum + 1}`;
}

async function generateNextInvoiceId(tenantId: string): Promise<string> {
  const existing = await prisma.invoice.findMany({
    where: { tenantId },
    select: { invoiceNumber: true },
  });

  let maxNum = 1000;
  for (const inv of existing) {
    if (inv.invoiceNumber && inv.invoiceNumber.startsWith('INV-')) {
      const num = parseInt(inv.invoiceNumber.replace('INV-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `INV-${maxNum + 1}`;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired or invalid.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const academicYearId = searchParams.get('academicYearId') || '';
    const term = searchParams.get('term') || '';
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';
    const paymentMethod = searchParams.get('paymentMethod') || '';
    const statusParam = (searchParams.get('status') || '').trim();
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    // Build Prisma where clause
    const where: any = {
      tenantId: session.tenantId,
    };

    if (paymentMethod && paymentMethod !== 'ALL') {
      where.paymentMethod = paymentMethod;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }

    if (academicYearId || term || classId || studentId) {
      where.invoice = {};
      if (academicYearId) {
        where.invoice.academicYearId = academicYearId;
      }
      if (term) {
        where.invoice.term = term;
      }
      if (studentId) {
        where.invoice.studentId = studentId;
      }
      if (classId) {
        where.invoice.student = {
          classId: classId,
        };
      }
    }

    if (statusParam && statusParam !== 'ALL') {
      if (!where.invoice) where.invoice = {};
      if (statusParam === 'Paid') {
        where.invoice.status = InvoiceStatus.PAID;
      } else if (statusParam === 'Part Payment') {
        where.invoice.status = InvoiceStatus.PARTIAL;
      } else if (statusParam === 'No Payment') {
        where.invoice.status = InvoiceStatus.UNPAID;
      }
    }

    if (q) {
      where.OR = [
        { receiptNumber: { contains: q, mode: 'insensitive' } },
        { transactionRef: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { paymentMethod: { contains: q, mode: 'insensitive' } },
        { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
        { invoice: { student: { firstName: { contains: q, mode: 'insensitive' } } } },
        { invoice: { student: { lastName: { contains: q, mode: 'insensitive' } } } },
        { invoice: { student: { studentId: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const rawPayments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          include: {
            student: {
              include: {
                class: true,
              },
            },
            academicYear: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const payments = rawPayments.map((p) => {
      const invoice = p.invoice;
      const student = invoice.student;
      const balance = Number(invoice.balance);
      const paidAmount = Number(invoice.paidAmount);
      const totalAmount = Number(invoice.totalAmount);

      let balanceStatus: 'Paid' | 'Part Payment' | 'No Payment' = 'No Payment';
      if (invoice.status === InvoiceStatus.PAID || balance <= 0) {
        balanceStatus = 'Paid';
      } else if (paidAmount > 0) {
        balanceStatus = 'Part Payment';
      }

      let categoryName = 'School Fees';
      if (invoice.itemsJson && typeof invoice.itemsJson === 'object') {
        const meta = invoice.itemsJson as any;
        if (meta.category) {
          categoryName = meta.category;
        }
      }

      return {
        id: p.id,
        transactionId: p.receiptNumber,
        receiptNumber: p.receiptNumber,
        invoiceId: p.invoiceId,
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
        paymentDate: p.createdAt.toISOString().split('T')[0],
        amountPaid: Number(p.amount),
        paymentMethod: p.paymentMethod,
        referenceNo: p.transactionRef || '',
        notes: p.notes || '',
        balance: balance,
        invoiceTotal: totalAmount,
        invoicePaid: paidAmount,
        balanceStatus: balanceStatus,
        recordedBy: p.recordedBy?.fullName || 'Administrator',
        createdAt: p.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      payments,
      totalCount: payments.length,
    });
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired or invalid.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      studentId,
      invoiceId,
      amountPaid,
      paymentMethod,
      referenceNo,
      paymentDate,
      academicYearId,
      term,
      notes,
    } = body;

    const parsedAmount = parseFloat(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Amount paid must be a valid positive number.' }, { status: 400 });
    }

    const tenantId = session.tenantId;

    // Resolve target Invoice
    let targetInvoice: any = null;

    if (invoiceId) {
      targetInvoice = await prisma.invoice.findFirst({
        where: {
          tenantId,
          OR: [{ id: invoiceId }, { invoiceNumber: invoiceId }],
        },
        include: {
          student: { include: { class: true } },
          academicYear: true,
        },
      });
    }

    // If no target invoice was found yet, resolve via student
    if (!targetInvoice && studentId) {
      const student = await prisma.student.findFirst({
        where: {
          tenantId,
          OR: [{ id: studentId }, { studentId: studentId }],
        },
        include: { class: true },
      });

      if (!student) {
        return NextResponse.json({ error: 'Selected student could not be found.' }, { status: 404 });
      }

      // Look for an existing open invoice for this student
      const openWhere: any = {
        tenantId,
        studentId: student.id,
        status: { not: InvoiceStatus.PAID },
      };
      if (academicYearId) {
        openWhere.academicYearId = academicYearId;
      }
      if (term) {
        openWhere.term = term;
      }

      targetInvoice = await prisma.invoice.findFirst({
        where: openWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { include: { class: true } },
          academicYear: true,
        },
      });

      // If no open invoice exists, auto-create one so relational integrity is preserved
      if (!targetInvoice) {
        let targetAcademicYearId = academicYearId;
        if (!targetAcademicYearId) {
          const activeYear = await prisma.academicYear.findFirst({
            where: { tenantId, status: 'Active' },
          });
          targetAcademicYearId = activeYear ? activeYear.id : (await prisma.academicYear.findFirst({ where: { tenantId } }))?.id;
        }

        if (!targetAcademicYearId) {
          return NextResponse.json(
            { error: 'An Academic Year must exist before recording payments.' },
            { status: 400 }
          );
        }

        const nextInvNumber = await generateNextInvoiceId(tenantId);
        const resolvedTerm = term || 'Term 1';

        targetInvoice = await prisma.invoice.create({
          data: {
            tenantId,
            invoiceNumber: nextInvNumber,
            studentId: student.id,
            academicYearId: targetAcademicYearId,
            term: resolvedTerm,
            totalAmount: parsedAmount,
            paidAmount: 0,
            balance: parsedAmount,
            status: InvoiceStatus.UNPAID,
            itemsJson: {
              category: 'General School Fees',
              description: 'Auto-generated invoice from fee collection',
              issueDate: paymentDate || new Date().toISOString().split('T')[0],
            },
          },
          include: {
            student: { include: { class: true } },
            academicYear: true,
          },
        });
      }
    }

    if (!targetInvoice) {
      return NextResponse.json(
        { error: 'Please select an invoice or student to record payment against.' },
        { status: 400 }
      );
    }

    const nextReceiptNumber = await generateNextPaymentId(tenantId);

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: targetInvoice.id,
          amount: parsedAmount,
          paymentMethod: paymentMethod || 'Cash',
          transactionRef: referenceNo?.trim() || null,
          receiptNumber: nextReceiptNumber,
          notes: notes?.trim() || null,
          recordedById: session.userId || null,
          createdAt: paymentDate ? new Date(`${paymentDate}T12:00:00.000Z`) : new Date(),
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

      // Recalculate invoice total payments
      const allPayments = await tx.payment.findMany({
        where: { invoiceId: targetInvoice.id, tenantId },
        select: { amount: true },
      });

      const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const invoiceTotal = Number(targetInvoice.totalAmount);
      const newBalance = Math.max(0, invoiceTotal - totalPaid);

      let newStatus: InvoiceStatus = InvoiceStatus.UNPAID;
      if (newBalance <= 0 && invoiceTotal > 0) {
        newStatus = InvoiceStatus.PAID;
      } else if (totalPaid > 0) {
        newStatus = InvoiceStatus.PARTIAL;
      }

      await tx.invoice.update({
        where: { id: targetInvoice.id },
        data: {
          paidAmount: totalPaid,
          balance: newBalance,
          status: newStatus,
        },
      });

      return {
        payment,
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

    const responsePayload = {
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
    };

    return NextResponse.json({
      success: true,
      message: `Payment recorded successfully! Receipt: ${payment.receiptNumber}`,
      payment: responsePayload,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json(
      { error: 'Failed to record payment', details: error.message },
      { status: 500 }
    );
  }
}
