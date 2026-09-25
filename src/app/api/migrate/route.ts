import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, hashPassword } from '@/lib/auth';

/**
 * Universal migration endpoint to import existing data from Google Apps Script SMS
 * into the SaaS tenant PostgreSQL database.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Valid admin session required.' }, { status: 401 });
    }

    const tenantId = session.tenantId;
    const body = await req.json();

    // Support both wrapped payload { migrationPayload: {...} } and direct payload { students: [...], ... }
    const payload = body.migrationPayload || body;

    const imported = {
      academicYears: 0,
      billingCategories: 0,
      classes: 0,
      subjects: 0,
      teachers: 0,
      students: 0,
    };

    // 1. Migrate Academic Years
    const academicYearsList = payload.academicYears || (payload.entity === 'academicYears' ? payload.rows : []);
    if (Array.isArray(academicYearsList)) {
      for (const item of academicYearsList) {
        const year = String(item.academicYear || item.year || '').trim();
        if (!year) continue;
        await prisma.academicYear.upsert({
          where: { tenantId_year: { tenantId, year } },
          update: {
            status: item.status || 'Active',
            currentTerm: item.currentTerm || item.terms || 'Term 1',
          },
          create: {
            tenantId,
            year,
            status: item.status || 'Active',
            currentTerm: item.currentTerm || item.terms || 'Term 1',
          },
        });
        imported.academicYears++;
      }
    }

    // 2. Migrate Billing Categories
    const billingList = payload.billingCategories || (payload.entity === 'billingCategories' ? payload.rows : []);
    if (Array.isArray(billingList)) {
      for (const item of billingList) {
        const name = String(item.category || item.name || '').trim();
        if (!name) continue;
        const defaultAmount = Number(item.totalAmount || item.defaultAmount || item.amount || 0);
        await prisma.billingCategory.upsert({
          where: { tenantId_name: { tenantId, name } },
          update: {
            defaultAmount,
            description: item.descriptions || item.description || null,
          },
          create: {
            tenantId,
            name,
            defaultAmount,
            description: item.descriptions || item.description || null,
          },
        });
        imported.billingCategories++;
      }
    }

    // 3. Migrate Classes
    const classesList = payload.classes || (payload.entity === 'classes' ? payload.rows : []);
    const classMap = new Map<string, string>(); // className -> classId

    if (Array.isArray(classesList)) {
      for (const item of classesList) {
        const name = String(item.className || item.name || '').trim();
        if (!name) continue;
        const savedClass = await prisma.class.upsert({
          where: { tenantId_name: { tenantId, name } },
          update: {},
          create: { tenantId, name },
        });
        classMap.set(name.toLowerCase(), savedClass.id);
        imported.classes++;
      }
    }

    // 4. Migrate Courses / Subjects
    const coursesList = payload.courses || payload.subjects || (payload.entity === 'courses' || payload.entity === 'subjects' ? payload.rows : []);
    if (Array.isArray(coursesList)) {
      for (const item of coursesList) {
        const name = String(item.courseName || item.subjectName || item.name || '').trim();
        if (!name) continue;
        const code = item.courseId || item.code || null;
        const credits = Number(item.credits) || 1;
        const semester = item.semester || null;

        await prisma.subject.upsert({
          where: { tenantId_name: { tenantId, name } },
          update: { code, credits, semester },
          create: {
            tenantId,
            name,
            code,
            credits,
            semester,
            status: 'ACTIVE',
          },
        });
        imported.subjects++;
      }
    }

    // 5. Migrate Teachers / Staff
    const teachersList = payload.teachers || (payload.entity === 'teachers' ? payload.rows : []);
    if (Array.isArray(teachersList)) {
      const defaultPassword = await hashPassword('Teacher2026!');
      for (const item of teachersList) {
        const fullName = String(item.fullName || item.name || item.teacherName || '').trim();
        const email = String(item.email || '').trim().toLowerCase();
        if (!fullName || !email) continue;

        await prisma.user.upsert({
          where: { tenantId_email: { tenantId, email } },
          update: { fullName, phone: item.phone || null },
          create: {
            tenantId,
            fullName,
            email,
            passwordHash: defaultPassword,
            role: 'TEACHER',
            phone: item.phone || null,
            status: 'ACTIVE',
          },
        });
        imported.teachers++;
      }
    }

    // 6. Migrate Students
    const studentsList = payload.students || (payload.entity === 'students' ? payload.rows : []);
    if (Array.isArray(studentsList)) {
      // Refresh classMap if not already populated
      if (classMap.size === 0) {
        const existingClasses = await prisma.class.findMany({
          where: { tenantId },
          select: { id: true, name: true },
        });
        for (const c of existingClasses) {
          classMap.set(c.name.toLowerCase(), c.id);
        }
      }

      for (const item of studentsList) {
        const firstName = String(item.firstName || '').trim();
        const lastName = String(item.lastName || '').trim();
        const studentId = String(item.studentId || item.id || '').trim();
        if (!firstName || !lastName || !studentId) continue;

        const className = String(item.class || item.className || '').trim().toLowerCase();
        const classId = className ? classMap.get(className) || null : null;

        await prisma.student.upsert({
          where: { tenantId_studentId: { tenantId, studentId } },
          update: {
            firstName,
            lastName,
            gender: item.gender || null,
            classId: classId || undefined,
            guardianName: item.guardianName || item.parentName || null,
            guardianPhone: item.guardianPhone || item.parentPhone || item.phone || null,
            guardianEmail: item.guardianEmail || item.parentEmail || item.email || null,
            address: item.address || null,
            status: item.status?.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          },
          create: {
            tenantId,
            studentId,
            firstName,
            lastName,
            gender: item.gender || null,
            classId: classId || null,
            guardianName: item.guardianName || item.parentName || null,
            guardianPhone: item.guardianPhone || item.parentPhone || item.phone || null,
            guardianEmail: item.guardianEmail || item.parentEmail || item.email || null,
            address: item.address || null,
            status: item.status?.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          },
        });
        imported.students++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully!',
      imported,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message || 'Server error during migration' }, { status: 500 });
  }
}
