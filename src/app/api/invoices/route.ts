import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { InvoiceStatus } from '@prisma/client';

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
    const statusParam = (searchParams.get('status') || '').toUpperCase();
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';

    const now = new Date();

    // Build Prisma where clause
    const where: any = {
      tenantId: session.tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (term) {
      where.term = term;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (classId) {
      where.student = {
        classId: classId,
      };
    }

    // Status filter
    if (statusParam === 'OVERDUE') {
      where.status = { not: InvoiceStatus.PAID };
      where.dueDate = { lt: now };
    } else if (statusParam && statusParam !== 'ALL') {
      if (Object.values(InvoiceStatus).includes(statusParam as InvoiceStatus)) {
        where.status = statusParam as InvoiceStatus;
      }
    }

    // Free text search
    if (q) {
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { student: { firstName: { contains: q, mode: 'insensitive' } } },
        { student: { lastName: { contains: q, mode: 'insensitive' } } },
        { student: { studentId: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const rawInvoices = await prisma.invoice.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            classId: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        academicYear: {
          select: {
            id: true,
            year: true,
            status: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            receiptNumber: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const invoices = rawInvoices.map((inv) => {
      const itemsMeta = (inv.itemsJson as any) || {};
      const isOverdue =
        inv.dueDate !== null &&
        new Date(inv.dueDate) < now &&
        inv.status !== InvoiceStatus.PAID;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        studentId: inv.studentId,
        student: inv.student,
        academicYearId: inv.academicYearId,
        academicYear: inv.academicYear,
        term: inv.term,
        category: itemsMeta.category || 'Tuition',
        items: itemsMeta.items || '',
        issueDate: itemsMeta.issueDate || inv.createdAt.toISOString().split('T')[0],
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        balance: Number(inv.balance),
        status: inv.status,
        dueDate: inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : null,
        isOverdue,
        payments: inv.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
        createdAt: inv.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: error.message || 'Server error fetching invoices.' }, { status: 500 });
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

    const tenantId = session.tenantId;
    const body = await req.json();

    // Mode A: Bulk Class Invoicing
    if (body.bulk === true) {
      const { classId, academicYearId, term, category, items, totalAmount, dueDate, issueDate } = body;

      if (!classId) {
        return NextResponse.json({ error: 'Class is required for bulk invoicing.' }, { status: 400 });
      }
      if (!academicYearId) {
        return NextResponse.json({ error: 'Academic Year is required.' }, { status: 400 });
      }
      if (!term) {
        return NextResponse.json({ error: 'Term is required.' }, { status: 400 });
      }
      const parsedTotal = parseFloat(totalAmount);
      if (isNaN(parsedTotal) || parsedTotal <= 0) {
        return NextResponse.json({ error: 'A valid total invoice amount greater than 0 is required.' }, { status: 400 });
      }

      // Verify academic year
      const yearRecord = await prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      });
      if (!yearRecord) {
        return NextResponse.json({ error: 'Academic Year not found.' }, { status: 404 });
      }

      // Find all students in class
      const students = await prisma.student.findMany({
        where: { classId, tenantId, status: 'ACTIVE' },
        select: { id: true, studentId: true, firstName: true, lastName: true },
      });

      if (students.length === 0) {
        return NextResponse.json({ error: 'No active students found in the selected class.' }, { status: 400 });
      }

      // Find existing invoices for these students for this year + term + category to avoid duplicates
      const existingInvoices = await prisma.invoice.findMany({
        where: {
          tenantId,
          academicYearId,
          term,
          studentId: { in: students.map((s) => s.id) },
        },
        select: { studentId: true, itemsJson: true },
      });

      const alreadyInvoicedStudentIds = new Set<string>();
      for (const inv of existingInvoices) {
        const meta = (inv.itemsJson as any) || {};
        if (!category || meta.category === category) {
          alreadyInvoicedStudentIds.add(inv.studentId);
        }
      }

      const studentsToInvoice = students.filter((s) => !alreadyInvoicedStudentIds.has(s.id));

      if (studentsToInvoice.length === 0) {
        return NextResponse.json({
          error: 'All students in this class already have invoices generated for this academic year, term, and category.',
        }, { status: 400 });
      }

      // Get next starting invoice ID
      const allExisting = await prisma.invoice.findMany({
        where: { tenantId },
        select: { invoiceNumber: true },
      });
      let maxNum = 1000;
      for (const inv of allExisting) {
        if (inv.invoiceNumber && inv.invoiceNumber.startsWith('INV-')) {
          const num = parseInt(inv.invoiceNumber.replace('INV-', ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }

      const createdCount = await prisma.$transaction(async (tx) => {
        let currentNum = maxNum;
        const newRecords = [];

        for (const student of studentsToInvoice) {
          currentNum++;
          const invoiceNumber = `INV-${currentNum}`;
          const itemsJson = {
            category: category || 'Tuition',
            items: items || `${category || 'Tuition'} Fee`,
            issueDate: issueDate || new Date().toISOString().split('T')[0],
          };

          newRecords.push(
            tx.invoice.create({
              data: {
                tenantId,
                invoiceNumber,
                studentId: student.id,
                academicYearId,
                term,
                itemsJson,
                totalAmount: parsedTotal,
                paidAmount: 0,
                balance: parsedTotal,
                status: InvoiceStatus.UNPAID,
                dueDate: dueDate ? new Date(dueDate) : null,
              },
            })
          );
        }

        await Promise.all(newRecords);
        return newRecords.length;
      });

      return NextResponse.json({
        success: true,
        count: createdCount,
        skipped: students.length - studentsToInvoice.length,
        message: `Successfully generated ${createdCount} invoice(s) for the class.${
          students.length - studentsToInvoice.length > 0
            ? ` (${students.length - studentsToInvoice.length} already had invoices)`
            : ''
        }`,
      });
    }

    // Mode B: Single Invoice Creation
    const {
      studentId,
      academicYearId,
      term,
      category,
      items,
      totalAmount,
      paidAmount,
      dueDate,
      issueDate,
    } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Please select a student.' }, { status: 400 });
    }
    if (!academicYearId) {
      return NextResponse.json({ error: 'Please select an academic year.' }, { status: 400 });
    }
    if (!term) {
      return NextResponse.json({ error: 'Please select a term.' }, { status: 400 });
    }

    const parsedTotal = parseFloat(totalAmount);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return NextResponse.json({ error: 'Total amount due must be a number greater than 0.' }, { status: 400 });
    }

    const parsedPaid = parseFloat(paidAmount || '0') || 0;
    if (parsedPaid < 0) {
      return NextResponse.json({ error: 'Paid amount cannot be negative.' }, { status: 400 });
    }

    // Verify student belongs to tenant
    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { class: true },
    });
    if (!student) {
      return NextResponse.json({ error: 'Selected student does not exist or belongs to another tenant.' }, { status: 404 });
    }

    // Verify academic year belongs to tenant
    const yearRecord = await prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });
    if (!yearRecord) {
      return NextResponse.json({ error: 'Selected academic year does not exist.' }, { status: 404 });
    }

    const invoiceNumber = await generateNextInvoiceId(tenantId);
    const balance = Math.max(0, parsedTotal - parsedPaid);
    const status = calculateInvoiceStatus(parsedTotal, parsedPaid);

    const itemsJson = {
      category: category || 'Tuition',
      items: items || '',
      issueDate: issueDate || new Date().toISOString().split('T')[0],
    };

    const newInvoice = await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        studentId: student.id,
        academicYearId,
        term,
        itemsJson,
        totalAmount: parsedTotal,
        paidAmount: parsedPaid,
        balance,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
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
        ...newInvoice,
        totalAmount: Number(newInvoice.totalAmount),
        paidAmount: Number(newInvoice.paidAmount),
        balance: Number(newInvoice.balance),
        category: itemsJson.category,
        items: itemsJson.items,
        issueDate: itemsJson.issueDate,
      },
      message: `Invoice ${invoiceNumber} created successfully.`,
    });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: error.message || 'Server error creating invoice.' }, { status: 500 });
  }
}
