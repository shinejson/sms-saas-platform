import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const session = verifyToken(authHeader.split(' ')[1]);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session.' }, { status: 401 });
    }

    const { tenantId } = session;
    const { searchParams } = new URL(req.url);
    const filterTerm = searchParams.get('term') || '';
    const filterYear = searchParams.get('academicYear') || '';
    const filterClass = searchParams.get('classId') || '';

    const years = await prisma.academicYear.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    let yearObj = years.find((y) => y.status === 'Active') ?? years[0] ?? null;
    if (filterYear) {
      const match = years.find((y) => y.year === filterYear || y.id === filterYear);
      if (match) yearObj = match;
    }

    const yearFilter = yearObj ? { academicYearId: yearObj.id } : {};
    const termFilter = filterTerm && filterTerm !== 'all' ? { term: filterTerm } : {};
    const classFilter = filterClass ? { classId: filterClass } : {};

    const [students, classesList, invoices, performances, attendanceRecords, teacherCount] = await Promise.all([
      prisma.student.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { class: { select: { id: true, name: true } } },
      }),
      prisma.class.findMany({
        where: { tenantId },
        include: { _count: { select: { students: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.invoice.findMany({
        where: { tenantId, ...yearFilter, ...termFilter },
        include: {
          student: { select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { name: true } } } },
          payments: { select: { amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.performance.findMany({
        where: { tenantId, ...yearFilter, ...termFilter, ...classFilter },
        include: { student: { select: { id: true, studentId: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      prisma.attendance.findMany({
        where: { tenantId, ...yearFilter, ...termFilter, ...classFilter },
        select: { status: true, studentId: true, classId: true },
        take: 5000,
      }),
      prisma.teacher.count({ where: { tenantId } }),
    ]);

    const totalStudents = students.length;
    const totalRevenue = invoices.reduce((s, i) => s + (i.payments?.reduce((ps, p) => ps + Number(p.amount), 0) ?? 0), 0);
    const totalBilled = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const outstanding = totalBilled - totalRevenue;

    const perfScores = performances.map((p) => Number(p.total)).filter((n) => !isNaN(n) && n >= 0);
    const avgPerformance = perfScores.length > 0 ? Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length) : 0;

    const enrollmentByClass = classesList.map((c) => ({ classId: c.id, className: c.name, studentCount: c._count.students })).sort((a, b) => b.studentCount - a.studentCount);

    let paid = 0, partial = 0, unpaid = 0, cancelled = 0;
    for (const inv of invoices) {
      if (inv.status === 'PAID') paid++;
      else if (inv.status === 'PARTIAL') partial++;
      else if (inv.status === 'CANCELLED') cancelled++;
      else unpaid++;
    }
    const billingStatus = { paid, partial, unpaid, cancelled, total: invoices.length };

    const studentPerfMap = new Map<string, { name: string; className: string; scores: number[] }>();
    for (const p of performances) {
      const key = p.studentId;
      if (!studentPerfMap.has(key)) {
        studentPerfMap.set(key, { name: p.student ? (p.student.firstName + ' ' + p.student.lastName) : p.studentId, className: p.studentClass ?? '—', scores: [] });
      }
      const score = Number(p.total);
      if (!isNaN(score)) studentPerfMap.get(key)!.scores.push(score);
    }
    const topPerformers = Array.from(studentPerfMap.entries())
      .map(([studentId, d]) => ({ studentId, name: d.name, className: d.className, avgScore: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0, grade: gradeLabel(d.scores.length > 0 ? d.scores.reduce((a, b) => a + b, 0) / d.scores.length : 0) }))
      .sort((a, b) => b.avgScore - a.avgScore).slice(0, 10);

    const subjectMap = new Map<string, number[]>();
    for (const p of performances) {
      const course = p.course || 'Unknown';
      if (!subjectMap.has(course)) subjectMap.set(course, []);
      const score = Number(p.total);
      if (!isNaN(score)) subjectMap.get(course)!.push(score);
    }
    const subjectAverages = Array.from(subjectMap.entries())
      .map(([course, scores]) => ({ course, avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, count: scores.length }))
      .sort((a, b) => b.avgScore - a.avgScore).slice(0, 12);

    const debtors = invoices.filter((i) => i.status === 'UNPAID' || i.status === 'PARTIAL')
      .map((i) => {
        const p = i.payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
        return { invoiceNumber: i.invoiceNumber, studentName: i.student ? (i.student.firstName + ' ' + i.student.lastName) : '—', studentClass: i.student?.class?.name ?? '—', totalAmount: Number(i.totalAmount), amountPaid: p, balance: Number(i.totalAmount) - p, status: i.status };
      }).sort((a, b) => b.balance - a.balance).slice(0, 50);

    const recentInvoices = invoices.slice(0, 20).map((i) => {
      const p = i.payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
      return { invoiceNumber: i.invoiceNumber, studentName: i.student ? (i.student.firstName + ' ' + i.student.lastName) : '—', studentClass: i.student?.class?.name ?? '—', totalAmount: Number(i.totalAmount), amountPaid: p, balance: Number(i.totalAmount) - p, status: i.status, createdAt: i.createdAt };
    });

    const attTotal = attendanceRecords.length;
    const attPresent = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const attAbsent = attendanceRecords.filter((a) => a.status === 'ABSENT').length;
    const attLate = attendanceRecords.filter((a) => a.status === 'LATE').length;
    const attExcused = attendanceRecords.filter((a) => a.status === 'EXCUSED').length;
    const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

    const genderMap = students.reduce((acc: Record<string, number>, s) => { const g = s.gender ?? 'Unknown'; acc[g] = (acc[g] ?? 0) + 1; return acc; }, {});

    const availableYears = years.map((y) => ({ id: y.id, year: y.year, status: y.status }));
    const availableClasses = classesList.map((c) => ({ id: c.id, name: c.name }));

    return NextResponse.json({
      success: true,
      filters: { activeYear: yearObj?.year ?? '', activeTerm: yearObj?.currentTerm ?? '', availableYears, availableClasses },
      kpis: { totalStudents, teacherCount, totalRevenue, outstanding, avgPerformance, attendanceRate },
      enrollmentByClass,
      billingStatus,
      topPerformers,
      subjectAverages,
      recentInvoices,
      debtors,
      attendance: { total: attTotal, present: attPresent, absent: attAbsent, late: attLate, excused: attExcused, rate: attendanceRate },
      genderBreakdown: genderMap,
    });
  } catch (error: any) {
    console.error('Reports route error:', error);
    return NextResponse.json({ error: 'Failed to generate reports.', details: error.message }, { status: 500 });
  }
}

function gradeLabel(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}
