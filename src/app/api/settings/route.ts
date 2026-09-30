import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const DEFAULT_SETTINGS = [
  { param: 'Class Score', value: '50', category: 'Grading' },
  { param: 'Exams Score', value: '50', category: 'Grading' },
  { param: 'Passing Mark', value: '50', category: 'Grading' },
  { param: 'School Motto', value: 'Knowledge, Integrity and Excellence', category: 'General' },
  { param: 'Current Term', value: 'Term 1', category: 'General' },
  { param: 'Principal Name', value: 'Head Administrator', category: 'General' },
  {
    param: 'Fee Categories',
    value: 'Tuition, Uniform, Books, PTA Levy, Transport, Feeding, Examination, Extra Classes, Excursion',
    category: 'Lists',
  },
  {
    param: 'Payment Methods',
    value: 'Cash, Mobile Money, Bank Transfer, Cheque',
    category: 'Lists',
  },
  {
    param: 'Invoice Statuses',
    value: 'Paid, Part Payment, No Payment',
    category: 'Lists',
  },
];

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired or invalid.' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    // 1. Fetch Tenant Profile
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        alias: true,
        subdomain: true,
        customDomain: true,
        logoUrl: true,
        address: true,
        email: true,
        phone: true,
        currency: true,
        plan: true,
        studentLimit: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant record not found.' }, { status: 404 });
    }

    // 2. Fetch or seed settings
    let settings = await prisma.setting.findMany({
      where: { tenantId },
      orderBy: { param: 'asc' },
    });

    if (settings.length === 0) {
      await prisma.setting.createMany({
        data: DEFAULT_SETTINGS.map((s) => ({
          tenantId,
          param: s.param,
          value: s.value,
          category: s.category,
        })),
        skipDuplicates: true,
      });

      settings = await prisma.setting.findMany({
        where: { tenantId },
        orderBy: { param: 'asc' },
      });
    }

    // 3. Helper to find param value
    const getVal = (paramName: string, fallback: string = '') => {
      const found = settings.find((s) => s.param.toLowerCase() === paramName.toLowerCase());
      return found ? found.value : fallback;
    };

    const classScore = parseFloat(getVal('Class Score', '50')) || 50;
    const examScore = parseFloat(getVal('Exams Score', '50')) || 50;
    const passingMark = parseFloat(getVal('Passing Mark', '50')) || 50;

    const parseList = (paramName: string, fallback: string[]) => {
      const raw = getVal(paramName);
      if (!raw) return fallback;
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const categories = parseList('Fee Categories', [
      'Tuition',
      'Uniform',
      'Books',
      'PTA Levy',
      'Transport',
      'Feeding',
      'Examination',
      'Extra Classes',
      'Excursion',
    ]);
    const methods = parseList('Payment Methods', ['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque']);
    const statuses = parseList('Invoice Statuses', ['Paid', 'Part Payment', 'No Payment']);

    // 4. Counts for backup/stats
    const [
      studentsCount,
      teachersCount,
      classesCount,
      invoicesCount,
      paymentsCount,
      attendanceCount,
      performanceCount,
    ] = await Promise.all([
      prisma.student.count({ where: { tenantId } }),
      prisma.teacher.count({ where: { tenantId } }),
      prisma.class.count({ where: { tenantId } }),
      prisma.invoice.count({ where: { tenantId } }),
      prisma.payment.count({ where: { tenantId } }),
      prisma.attendance.count({ where: { tenantId } }),
      prisma.performance.count({ where: { tenantId } }),
    ]);

    // 5. Recent audit logs for tenant
    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      tenant,
      parameters: settings,
      scorePercentages: {
        classScore,
        examScore,
        passingMark,
      },
      lists: {
        categories,
        methods,
        statuses,
      },
      stats: {
        studentsCount,
        teachersCount,
        classesCount,
        invoicesCount,
        paymentsCount,
        attendanceCount,
        performanceCount,
      },
      auditLogs,
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Session expired or invalid.' }, { status: 401 });
    }

    const tenantId = session.tenantId;
    const body = await req.json();

    const { profile, scorePercentages, parameters, lists } = body;

    // 1. Update School Profile on Tenant model
    if (profile) {
      const { name, alias, logoUrl, address, email, phone, currency } = profile;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(alias !== undefined ? { alias: alias.trim() } : {}),
          ...(logoUrl !== undefined ? { logoUrl: logoUrl.trim() || null } : {}),
          ...(address !== undefined ? { address: address.trim() || null } : {}),
          ...(email !== undefined ? { email: email.trim() || null } : {}),
          ...(phone !== undefined ? { phone: phone.trim() || null } : {}),
          ...(currency ? { currency: currency.trim().toUpperCase() } : {}),
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: session.userId || null,
          action: 'UPDATE_PROFILE',
          entity: 'Settings',
          details: `Updated school profile details for tenant ${name || tenantId}`,
        },
      });
    }

    // 2. Update Grading Weights
    if (scorePercentages) {
      const classScore = parseFloat(scorePercentages.classScore);
      const examScore = parseFloat(scorePercentages.examScore);

      if (isNaN(classScore) || isNaN(examScore)) {
        return NextResponse.json({ error: 'Class Score and Exam Score must be valid numbers.' }, { status: 400 });
      }

      if (Math.round(classScore + examScore) !== 100) {
        return NextResponse.json(
          { error: `The sum of Class Score (${classScore}%) and Exam Score (${examScore}%) must equal exactly 100%.` },
          { status: 400 }
        );
      }

      await prisma.setting.upsert({
        where: { tenantId_param: { tenantId, param: 'Class Score' } },
        update: { value: String(classScore), category: 'Grading' },
        create: { tenantId, param: 'Class Score', value: String(classScore), category: 'Grading' },
      });

      await prisma.setting.upsert({
        where: { tenantId_param: { tenantId, param: 'Exams Score' } },
        update: { value: String(examScore), category: 'Grading' },
        create: { tenantId, param: 'Exams Score', value: String(examScore), category: 'Grading' },
      });

      if (scorePercentages.passingMark !== undefined) {
        const passMark = parseFloat(scorePercentages.passingMark) || 50;
        await prisma.setting.upsert({
          where: { tenantId_param: { tenantId, param: 'Passing Mark' } },
          update: { value: String(passMark), category: 'Grading' },
          create: { tenantId, param: 'Passing Mark', value: String(passMark), category: 'Grading' },
        });
      }

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: session.userId || null,
          action: 'UPDATE_GRADING_WEIGHTS',
          entity: 'Settings',
          details: `Updated grading weights to Class: ${classScore}%, Exams: ${examScore}%`,
        },
      });
    }

    // 3. Update Lists (Fee Categories or Payment Methods)
    if (lists) {
      if (Array.isArray(lists.categories)) {
        const joined = lists.categories.map((s: string) => s.trim()).filter(Boolean).join(', ');
        await prisma.setting.upsert({
          where: { tenantId_param: { tenantId, param: 'Fee Categories' } },
          update: { value: joined, category: 'Lists' },
          create: { tenantId, param: 'Fee Categories', value: joined, category: 'Lists' },
        });
      }

      if (Array.isArray(lists.methods)) {
        const joined = lists.methods.map((s: string) => s.trim()).filter(Boolean).join(', ');
        await prisma.setting.upsert({
          where: { tenantId_param: { tenantId, param: 'Payment Methods' } },
          update: { value: joined, category: 'Lists' },
          create: { tenantId, param: 'Payment Methods', value: joined, category: 'Lists' },
        });
      }

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: session.userId || null,
          action: 'UPDATE_SYSTEM_LISTS',
          entity: 'Settings',
          details: 'Updated system lists options (Fee Categories / Payment Methods)',
        },
      });
    }

    // 4. Update Custom Parameters
    if (Array.isArray(parameters)) {
      for (const p of parameters) {
        if (p.param && p.value !== undefined) {
          await prisma.setting.upsert({
            where: { tenantId_param: { tenantId, param: p.param.trim() } },
            update: { value: String(p.value).trim(), category: p.category || 'General' },
            create: { tenantId, param: p.param.trim(), value: String(p.value).trim(), category: p.category || 'General' },
          });
        }
      }
    } else if (parameters && parameters.param && parameters.value !== undefined) {
      await prisma.setting.upsert({
        where: { tenantId_param: { tenantId, param: parameters.param.trim() } },
        update: { value: String(parameters.value).trim(), category: parameters.category || 'General' },
        create: { tenantId, param: parameters.param.trim(), value: String(parameters.value).trim(), category: parameters.category || 'General' },
      });
    }

    // Return refreshed settings
    const updatedTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const updatedSettings = await prisma.setting.findMany({
      where: { tenantId },
      orderBy: { param: 'asc' },
    });

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully.',
      tenant: updatedTenant,
      parameters: updatedSettings,
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}
