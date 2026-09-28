import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, hashPassword } from '@/lib/auth';

/**
 * Universal migration endpoint to import existing data from Google Apps Script SMS
 * into the SaaS tenant PostgreSQL database. Supports all 18 Google Sheets tabs.
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
      billings: 0,
      billingCategories: 0,
      classes: 0,
      subjects: 0,
      teachers: 0,
      students: 0,
      enrollments: 0,
      performance: 0,
      parents: 0,
      settings: 0,
      permissions: 0,
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

    // 2. Migrate Billings (Individual Fee Items)
    const billingsList = payload.billings || (payload.entity === 'billings' ? payload.rows : []);
    if (Array.isArray(billingsList)) {
      for (const item of billingsList) {
        const billingId = String(item.billingId || item.id || `BIL-${Math.floor(1000 + Math.random() * 9000)}`).trim();
        const itemName = String(item.item || item.name || '').trim();
        if (!itemName) continue;
        await prisma.billing.upsert({
          where: { tenantId_billingId: { tenantId, billingId } },
          update: {
            item: itemName,
            amount: Number(item.amount) || 0,
            status: item.status || 'Active',
            description: item.description || null,
          },
          create: {
            tenantId,
            billingId,
            item: itemName,
            amount: Number(item.amount) || 0,
            status: item.status || 'Active',
            description: item.description || null,
          },
        });
        imported.billings++;
      }
    }

    // 3. Migrate Billing Categories (Category Fee Structures)
    const billingCatList = payload.billingCategories || (payload.entity === 'billingCategories' ? payload.rows : []);
    if (Array.isArray(billingCatList)) {
      for (const item of billingCatList) {
        const name = String(item.category || item.name || '').trim();
        if (!name) continue;
        const categoryId = item.id || item.categoryId || `BC-${Math.floor(1000 + Math.random() * 9000)}`;
        const totalAmount = Number(item.totalAmount || item.defaultAmount || item.amount || 0);
        await prisma.billingCategory.create({
          data: {
            tenantId,
            categoryId,
            name,
            academicYear: item.academicYear || null,
            term: item.terms || item.term || null,
            items: Array.isArray(item.items) ? item.items.join(', ') : (item.items || null),
            totalAmount,
            defaultAmount: totalAmount,
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
    const subjectMap = new Map<string, string>(); // code/name -> subjectId

    if (Array.isArray(coursesList)) {
      for (const item of coursesList) {
        const name = String(item.courseName || item.subjectName || item.name || '').trim();
        if (!name) continue;
        const code = item.courseId || item.code || null;
        const credits = Number(item.credits) || 1;
        const semester = item.semester || null;

        const savedSubject = await prisma.subject.upsert({
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
        if (code) subjectMap.set(String(code).toLowerCase(), savedSubject.id);
        subjectMap.set(name.toLowerCase(), savedSubject.id);
        imported.subjects++;
      }
    }

    // 5. Migrate Teachers
    const teachersList = payload.teachers || (payload.entity === 'teachers' ? payload.rows : []);
    if (Array.isArray(teachersList)) {
      const defaultPassword = await hashPassword('Teacher2026!');
      for (const item of teachersList) {
        const firstName = String(item.firstName || '').trim();
        const lastName = String(item.lastName || '').trim();
        const fullName = String(item.fullName || item.name || `${firstName} ${lastName}`).trim();
        const teacherId = String(item.teacherId || item.id || `TCH-${Math.floor(1000 + Math.random() * 9000)}`).trim();
        const email = String(item.email || `${teacherId.toLowerCase()}@school.internal`).trim().toLowerCase();
        const className = String(item.class || item.className || '').trim();
        const classId = className ? classMap.get(className.toLowerCase()) || null : null;

        // Upsert into Teacher model
        await prisma.teacher.upsert({
          where: { tenantId_teacherId: { tenantId, teacherId } },
          update: {
            firstName: firstName || fullName.split(' ')[0] || 'Teacher',
            lastName: lastName || fullName.split(' ').slice(1).join(' ') || 'Staff',
            className: className || null,
            classId,
            academicYear: item.academicYear || null,
            phone: item.phone || null,
            email: item.email || null,
          },
          create: {
            tenantId,
            teacherId,
            firstName: firstName || fullName.split(' ')[0] || 'Teacher',
            lastName: lastName || fullName.split(' ').slice(1).join(' ') || 'Staff',
            className: className || null,
            classId,
            academicYear: item.academicYear || null,
            phone: item.phone || null,
            email: item.email || null,
            status: 'ACTIVE',
          },
        });

        // Also ensure user login exists for staff
        if (email) {
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
        }
        imported.teachers++;
      }
    }

    // 6. Migrate Students
    const studentsList = payload.students || (payload.entity === 'students' ? payload.rows : []);
    const studentMap = new Map<string, string>(); // studentId (code) -> db id

    if (Array.isArray(studentsList)) {
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

        const savedStudent = await prisma.student.upsert({
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
        studentMap.set(studentId.toLowerCase(), savedStudent.id);
        imported.students++;
      }
    }

    // Helper: Ensure studentMap is populated
    if (studentMap.size === 0) {
      const existingStudents = await prisma.student.findMany({
        where: { tenantId },
        select: { id: true, studentId: true },
      });
      for (const s of existingStudents) {
        studentMap.set(s.studentId.toLowerCase(), s.id);
      }
    }

    // 7. Migrate Enrollments
    const enrollmentsList = payload.enrollments || (payload.entity === 'enrollments' ? payload.rows : []);
    if (Array.isArray(enrollmentsList)) {
      for (const item of enrollmentsList) {
        const enrollmentId = String(item.enrollmentId || item.id || '').trim();
        const studentIdCode = String(item.studentId || '').trim();
        const courseIdCode = String(item.courseId || item.subjectId || '').trim();
        if (!studentIdCode) continue;

        const studentDbId = studentMap.get(studentIdCode.toLowerCase());
        if (!studentDbId) continue;

        const subjectDbId = courseIdCode ? subjectMap.get(courseIdCode.toLowerCase()) || null : null;
        const finalEnrollmentId = enrollmentId || `ENR-${studentIdCode}-${courseIdCode || Math.floor(Math.random() * 1000)}`;

        await prisma.enrollment.upsert({
          where: { tenantId_enrollmentId: { tenantId, enrollmentId: finalEnrollmentId } },
          update: {
            subjectId: subjectDbId || undefined,
            grade: item.grade || null,
            status: item.status || 'Active',
          },
          create: {
            tenantId,
            enrollmentId: finalEnrollmentId,
            studentId: studentDbId,
            subjectId: subjectDbId || null,
            courseCode: courseIdCode || null,
            grade: item.grade || null,
            status: item.status || 'Active',
          },
        });
        imported.enrollments++;
      }
    }

    // 8. Migrate Performance Records
    const performanceList = payload.performance || (payload.entity === 'performance' ? payload.rows : []);
    if (Array.isArray(performanceList)) {
      for (const item of performanceList) {
        const studentIdCode = String(item.studentId || '').trim();
        if (!studentIdCode) continue;

        const studentDbId = studentMap.get(studentIdCode.toLowerCase());
        if (!studentDbId) continue;

        const term = String(item.term || 'Term 1').trim();
        const academicYear = String(item.academicYear || item.year || '2025/2026').trim();
        const course = String(item.course || item.subject || 'General').trim();

        await prisma.performance.create({
          data: {
            tenantId,
            performanceId: item.performanceId || null,
            studentId: studentDbId,
            studentName: item.studentName || null,
            studentClass: item.studentClass || item.class || null,
            term,
            academicYear,
            course,
            classScore: Number(item.classScore) || 0,
            examScore100: Number(item.examScore100) || 0,
            examScore60: Number(item.examScore60 || item.examScore50) || 0,
            total: Number(item.total) || 0,
            grade: item.grade || null,
            rank: item.rank ? String(item.rank) : null,
            remarks: item.remarks || null,
          },
        });
        imported.performance++;
      }
    }

    // 9. Migrate Parents
    const parentsList = payload.parents || (payload.entity === 'parents' ? payload.rows : []);
    if (Array.isArray(parentsList)) {
      for (const item of parentsList) {
        const mappingId = String(item.mappingId || item.id || `PAR-${Math.floor(1000 + Math.random() * 9000)}`).trim();
        const studentIdCode = String(item.studentId || '').trim();
        if (!studentIdCode) continue;

        const studentDbId = studentMap.get(studentIdCode.toLowerCase());
        if (!studentDbId) continue;

        await prisma.parent.upsert({
          where: { tenantId_mappingId: { tenantId, mappingId } },
          update: {
            parentName: String(item.parentName || 'Parent').trim(),
            relationship: item.relationship || 'Guardian',
            isPrimary: Boolean(item.isPrimary),
            billing: item.billing ? String(item.billing) : null,
            phone: item.phone || null,
            email: item.email || null,
          },
          create: {
            tenantId,
            mappingId,
            parentName: String(item.parentName || 'Parent').trim(),
            studentId: studentDbId,
            relationship: item.relationship || 'Guardian',
            isPrimary: Boolean(item.isPrimary),
            billing: item.billing ? String(item.billing) : null,
            phone: item.phone || null,
            email: item.email || null,
          },
        });
        imported.parents++;
      }
    }

    // 10. Migrate Settings
    const settingsList = payload.settings || (payload.entity === 'settings' ? payload.rows : []);
    if (Array.isArray(settingsList)) {
      for (const item of settingsList) {
        const param = String(item.param || item.parameter || item.key || '').trim();
        const value = String(item.value || '').trim();
        if (!param) continue;

        await prisma.setting.upsert({
          where: { tenantId_param: { tenantId, param } },
          update: { value, category: item.category || 'General' },
          create: { tenantId, param, value, category: item.category || 'General' },
        });
        imported.settings++;
      }
    }

    // 11. Migrate Permissions
    const permissionsList = payload.permissions || (payload.entity === 'permissions' ? payload.rows : []);
    if (Array.isArray(permissionsList)) {
      for (const item of permissionsList) {
        const role = String(item.role || '').trim();
        if (!role) continue;

        await prisma.permission.upsert({
          where: { tenantId_role: { tenantId, role } },
          update: {
            accessLevel: String(item.accessLevel || 'Read').trim(),
            actions: String(item.actions || '*').trim(),
          },
          create: {
            tenantId,
            role,
            accessLevel: String(item.accessLevel || 'Read').trim(),
            actions: String(item.actions || '*').trim(),
          },
        });
        imported.permissions++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully across all Google Sheets modules!',
      imported,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message || 'Server error during migration' }, { status: 500 });
  }
}
