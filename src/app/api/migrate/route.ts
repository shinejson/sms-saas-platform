import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

/**
 * Migration endpoint to import existing data from Google Apps Script SMS
 * into the SaaS tenant database.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'SCHOOL_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity, rows } = await req.json();
    const tenantId = session.tenantId;

    if (!entity || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let importedCount = 0;

    if (entity === 'students') {
      for (const row of rows) {
        if (!row.studentId || !row.firstName || !row.lastName) continue;
        await prisma.student.upsert({
          where: {
            tenantId_studentId: { tenantId, studentId: String(row.studentId).trim() },
          },
          update: {
            firstName: String(row.firstName).trim(),
            lastName: String(row.lastName).trim(),
            gender: row.gender || null,
            status: row.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
          },
          create: {
            tenantId,
            studentId: String(row.studentId).trim(),
            firstName: String(row.firstName).trim(),
            lastName: String(row.lastName).trim(),
            gender: row.gender || null,
            status: row.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
          },
        });
        importedCount++;
      }
    } else if (entity === 'courses' || entity === 'subjects') {
      for (const row of rows) {
        const name = String(row.name || row.courseName || row.subjectName || '').trim();
        if (!name) continue;
        await prisma.subject.upsert({
          where: {
            tenantId_name: { tenantId, name },
          },
          update: {
            code: row.code || null,
            credits: Number(row.credits) || 1,
            semester: row.semester || null,
          },
          create: {
            tenantId,
            name,
            code: row.code || null,
            credits: Number(row.credits) || 1,
            semester: row.semester || null,
          },
        });
        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      entity,
      importedCount,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
