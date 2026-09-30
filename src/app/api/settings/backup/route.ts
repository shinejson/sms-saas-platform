import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired or invalid.' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant record not found.' }, { status: 404 });
    }

    // Export all tenant records in parallel
    const [
      students,
      teachers,
      classes,
      subjects,
      academicYears,
      invoices,
      payments,
      attendance,
      performances,
      settings,
      billingCategories,
    ] = await Promise.all([
      prisma.student.findMany({ where: { tenantId } }),
      prisma.teacher.findMany({ where: { tenantId } }),
      prisma.class.findMany({ where: { tenantId } }),
      prisma.subject.findMany({ where: { tenantId } }),
      prisma.academicYear.findMany({ where: { tenantId } }),
      prisma.invoice.findMany({ where: { tenantId } }),
      prisma.payment.findMany({ where: { tenantId } }),
      prisma.attendance.findMany({ where: { tenantId } }),
      prisma.performance.findMany({ where: { tenantId } }),
      prisma.setting.findMany({ where: { tenantId } }),
      prisma.billingCategory.findMany({ where: { tenantId } }),
    ]);

    const backupSnapshot = {
      metadata: {
        version: '1.0.0',
        platform: 'SMS Global SaaS Platform',
        exportedAt: new Date().toISOString(),
        tenantId: tenant.id,
        tenantName: tenant.name,
        subdomain: tenant.subdomain,
        summary: {
          students: students.length,
          teachers: teachers.length,
          classes: classes.length,
          subjects: subjects.length,
          academicYears: academicYears.length,
          invoices: invoices.length,
          payments: payments.length,
          attendance: attendance.length,
          performances: performances.length,
          settings: settings.length,
        },
      },
      tenant,
      students,
      teachers,
      classes,
      subjects,
      academicYears,
      billingCategories,
      invoices,
      payments,
      attendance,
      performances,
      settings,
    };

    // Log the backup export
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: session.userId || null,
        action: 'EXPORT_BACKUP',
        entity: 'Settings',
        details: `Exported full tenant data backup snapshot (${students.length} students, ${invoices.length} invoices, ${payments.length} payments)`,
      },
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `sms_backup_${tenant.subdomain}_${dateStr}.json`;

    return new NextResponse(JSON.stringify(backupSnapshot, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating tenant backup:', error);
    return NextResponse.json(
      { error: 'Failed to generate backup snapshot', details: error.message },
      { status: 500 }
    );
  }
}
