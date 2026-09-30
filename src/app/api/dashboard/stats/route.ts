import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized. Missing token.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const reqYear = searchParams.get('academicYear');
    const reqTerm = searchParams.get('term');
    const reqDate = searchParams.get('date');

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      include: {
        academicYears: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    // Determine active / selected academic year
    let academicYears = tenant.academicYears;
    if (academicYears.length === 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const defaultYearStr = `${currentYear}/${currentYear + 1}`;
      try {
        const createdYear = await prisma.academicYear.create({
          data: {
            tenantId: tenant.id,
            year: defaultYearStr,
            status: 'Active',
            currentTerm: 'Term 1',
          },
        });
        academicYears = [createdYear];
      } catch (err) {
        console.error('Failed to auto-seed academic year for tenant:', err);
      }
    }

    const availableYears = academicYears.map((y) => ({
      id: y.id,
      year: y.year,
      status: y.status,
      currentTerm: y.currentTerm,
    }));

    let selectedYearObj = academicYears.find((y) => y.status === 'Active') || academicYears[0];
    if (reqYear && reqYear !== 'all') {
      const match = academicYears.find((y) => y.year === reqYear);
      if (match) selectedYearObj = match;
    }

    const selectedYear = selectedYearObj ? selectedYearObj.year : '';
    const selectedTerm = reqTerm || 'All Terms';

    // Fetch core models in parallel
    const [students, classes, subjectCount, staffCount, billingCategoryCount, invoices, attendanceRecords] =
      await Promise.all([
        prisma.student.findMany({
          where: { tenantId: session.tenantId, status: 'ACTIVE' },
          include: { class: true },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.class.findMany({
          where: { tenantId: session.tenantId },
          orderBy: { name: 'asc' },
        }),
        prisma.subject.count({ where: { tenantId: session.tenantId, status: 'ACTIVE' } }),
        prisma.user.count({ where: { tenantId: session.tenantId, status: 'ACTIVE' } }),
        prisma.billingCategory.count({ where: { tenantId: session.tenantId } }),
        prisma.invoice.findMany({
          where: {
            tenantId: session.tenantId,
            ...(selectedYearObj ? { academicYearId: selectedYearObj.id } : {}),
            ...(selectedTerm && selectedTerm !== 'All Terms' ? { term: selectedTerm } : {}),
          },
          include: {
            student: { include: { class: true } },
            payments: true,
          },
        }),
        prisma.attendance.findMany({
          where: {
            tenantId: session.tenantId,
            ...(selectedYearObj ? { academicYearId: selectedYearObj.id } : {}),
            ...(selectedTerm && selectedTerm !== 'All Terms' ? { term: selectedTerm } : {}),
            ...(reqDate ? { date: new Date(reqDate) } : {}),
          },
        }),
      ]);

    // 1. KPI Calculations
    const totalStudents = students.length;
    const activeSubjects = subjectCount;

    let averageAttendance = '0%';
    if (attendanceRecords.length > 0) {
      const present = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
      averageAttendance = `${Math.round((present / attendanceRecords.length) * 100)}%`;
    }

    const totalInvoices = invoices.length;

    // 2. Chart: Students by Class
    const classMap: { [key: string]: number } = {};
    for (const c of classes) {
      classMap[c.name] = 0;
    }
    classMap['Unassigned'] = 0;

    for (const s of students) {
      const cName = s.class ? s.class.name : 'Unassigned';
      classMap[cName] = (classMap[cName] || 0) + 1;
    }

    // Only include classes that either exist or have students
    const studentsByClass = Object.keys(classMap)
      .filter((cName) => classMap[cName] > 0 || classes.some((c) => c.name === cName))
      .map((cName) => ({
        className: cName,
        studentCount: classMap[cName],
      }));

    // 3. Chart: Payment Status by Class (Paid vs Unpaid)
    // Map student invoices to determine paid status
    const studentPaymentMap: { [studentId: string]: 'PAID' | 'UNPAID' } = {};
    for (const inv of invoices) {
      const isPaid = inv.status === 'PAID' || Number(inv.balance) <= 0;
      if (!isPaid) {
        studentPaymentMap[inv.studentId] = 'UNPAID';
      } else if (!studentPaymentMap[inv.studentId]) {
        studentPaymentMap[inv.studentId] = 'PAID';
      }
    }

    const paymentByClassMap: { [className: string]: { paid: number; unpaid: number } } = {};
    for (const item of studentsByClass) {
      paymentByClassMap[item.className] = { paid: 0, unpaid: 0 };
    }

    for (const s of students) {
      const cName = s.class ? s.class.name : 'Unassigned';
      if (!paymentByClassMap[cName]) {
        paymentByClassMap[cName] = { paid: 0, unpaid: 0 };
      }
      const status = studentPaymentMap[s.id] || 'UNPAID';
      if (status === 'PAID') {
        paymentByClassMap[cName].paid += 1;
      } else {
        paymentByClassMap[cName].unpaid += 1;
      }
    }

    const paymentStatusByClass = Object.keys(paymentByClassMap).map((className) => ({
      className,
      paidStudents: paymentByClassMap[className].paid,
      unpaidStudents: paymentByClassMap[className].unpaid,
    }));

    // 4. Chart: Attendance Trend
    // Group attendance records by month or provide current month marker
    const attendanceTrendMap: { [month: string]: { present: number; total: number } } = {};
    for (const att of attendanceRecords) {
      const monthKey = new Date(att.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!attendanceTrendMap[monthKey]) {
        attendanceTrendMap[monthKey] = { present: 0, total: 0 };
      }
      attendanceTrendMap[monthKey].total += 1;
      if (att.status === 'PRESENT') attendanceTrendMap[monthKey].present += 1;
    }

    let attendanceTrend = Object.keys(attendanceTrendMap).map((month) => ({
      label: month,
      percentage: Math.round((attendanceTrendMap[month].present / attendanceTrendMap[month].total) * 100),
    }));

    if (attendanceTrend.length === 0) {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      attendanceTrend = [
        { label: prev.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), percentage: 0 },
        { label: now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), percentage: 0 },
      ];
    }

    // 5. Quick Insights Calculations
    const paidInvoices = invoices.filter((i) => i.status === 'PAID').length;
    const partialInvoices = invoices.filter((i) => i.status === 'PARTIAL').length;
    const unpaidInvoices = invoices.filter((i) => i.status === 'UNPAID').length;

    const totalBilled = invoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
    const paymentsCount = invoices.reduce((sum, i) => sum + (i.payments ? i.payments.length : 0), 0);
    const collectedAmount = invoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0);
    const collectedPercentage = totalBilled > 0 ? Math.round((collectedAmount / totalBilled) * 100) : 0;
    const outstandingAmount = Math.max(0, totalBilled - collectedAmount);
    const outstandingPercentage = totalBilled > 0 ? 100 - collectedPercentage : 0;

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        alias: tenant.alias,
        subdomain: tenant.subdomain,
        currency: tenant.currency || 'GHS',
        plan: tenant.plan,
        studentLimit: tenant.studentLimit,
      },
      availableYears,
      activeYear: selectedYear,
      activeTerm: selectedTerm,
      stats: {
        studentCount: totalStudents,
        studentLimit: tenant.studentLimit,
        quotaPercentage: tenant.studentLimit > 0 ? Math.round((totalStudents / tenant.studentLimit) * 100) : 0,
        classCount: classes.length,
        subjectCount: activeSubjects,
        staffCount,
        billingCategoryCount,
        activeYear: selectedYear,
        currentTerm: selectedYearObj ? selectedYearObj.currentTerm : '',
      },
      kpis: {
        totalStudents,
        activeSubjects,
        averageAttendance,
        totalInvoices,
      },
      charts: {
        paymentStatusByClass,
        attendanceTrend,
        studentsByClass,
      },
      quickInsights: {
        invoicesCount: totalInvoices,
        paidInvoices,
        partialInvoices,
        unpaidInvoices,
        totalBilled,
        paymentsCount,
        collectedAmount,
        collectedPercentage,
        outstandingAmount,
        outstandingPercentage,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

