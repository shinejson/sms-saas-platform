import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { verifyTenantStudentQuota } from '@/lib/tenant';

// Validation error structure
interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: ValidationError[];
  summary: {
    withDateOfBirth: number;
    withClass: number;
    withGuardian: number;
    duplicateStudentIds: string[];
  };
}

// Validate a single student record
function validateStudentRecord(
  record: Record<string, unknown>,
  rowIndex: number,
  existingStudentIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Required fields
  const firstName = String(record.firstName || '').trim();
  const lastName = String(record.lastName || '').trim();
  const studentId = String(record.studentId || '').trim();
  const gender = String(record.gender || '').trim();
  const dateOfBirth = record.dateOfBirth;
  const className = String(record.className || record.class || '').trim();
  const guardianName = String(record.guardianName || '').trim();
  const guardianPhone = String(record.guardianPhone || '').trim();
  const guardianEmail = String(record.guardianEmail || '').trim();

  // First name validation
  if (!firstName) {
    errors.push({
      row: rowIndex,
      field: 'firstName',
      value: String(record.firstName || ''),
      message: 'First name is required',
    });
  } else if (firstName.length < 2) {
    errors.push({
      row: rowIndex,
      field: 'firstName',
      value: firstName,
      message: 'First name must be at least 2 characters',
    });
  } else if (!/^[a-zA-Z\s'-]+$/.test(firstName)) {
    errors.push({
      row: rowIndex,
      field: 'firstName',
      value: firstName,
      message: 'First name contains invalid characters',
    });
  }

  // Last name validation
  if (!lastName) {
    errors.push({
      row: rowIndex,
      field: 'lastName',
      value: String(record.lastName || ''),
      message: 'Last name is required',
    });
  } else if (lastName.length < 2) {
    errors.push({
      row: rowIndex,
      field: 'lastName',
      value: lastName,
      message: 'Last name must be at least 2 characters',
    });
  } else if (!/^[a-zA-Z\s'-]+$/.test(lastName)) {
    errors.push({
      row: rowIndex,
      field: 'lastName',
      value: lastName,
      message: 'Last name contains invalid characters',
    });
  }

  // Student ID validation
  if (!studentId) {
    errors.push({
      row: rowIndex,
      field: 'studentId',
      value: String(record.studentId || ''),
      message: 'Student ID is required',
    });
  } else if (studentId.length < 2) {
    errors.push({
      row: rowIndex,
      field: 'studentId',
      value: studentId,
      message: 'Student ID must be at least 2 characters',
    });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(studentId)) {
    errors.push({
      row: rowIndex,
      field: 'studentId',
      value: studentId,
      message: 'Student ID contains invalid characters (use letters, numbers, underscore, or hyphen)',
    });
  }

  // Gender validation (if provided)
  if (gender && !['male', 'female', 'other', 'not specified'].includes(gender.toLowerCase())) {
    errors.push({
      row: rowIndex,
      field: 'gender',
      value: gender,
      message: 'Gender must be Male, Female, Other, or Not Specified',
    });
  }

  // Date of birth validation (if provided)
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth as string);
    if (isNaN(dob.getTime())) {
      errors.push({
        row: rowIndex,
        field: 'dateOfBirth',
        value: String(dateOfBirth),
        message: 'Invalid date format (use YYYY-MM-DD)',
      });
    } else {
      const today = new Date();
      const minDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate()); // Max 25 years ago
      const maxDate = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate()); // Min 3 years ago
      
      if (dob > today) {
        errors.push({
          row: rowIndex,
          field: 'dateOfBirth',
          value: String(dateOfBirth),
          message: 'Date of birth cannot be in the future',
        });
      } else if (dob < minDate) {
        errors.push({
          row: rowIndex,
          field: 'dateOfBirth',
          value: String(dateOfBirth),
          message: 'Date of birth indicates student is too old (max 25 years)',
        });
      } else if (dob > maxDate) {
        errors.push({
          row: rowIndex,
          field: 'dateOfBirth',
          value: String(dateOfBirth),
          message: 'Date of birth indicates student is too young (min 3 years)',
        });
      }
    }
  }

  // Guardian phone validation (if provided)
  if (guardianPhone && !/^[0-9+\-\s()]+$/.test(guardianPhone)) {
    errors.push({
      row: rowIndex,
      field: 'guardianPhone',
      value: guardianPhone,
      message: 'Guardian phone contains invalid characters',
    });
  }

  // Guardian email validation (if provided)
  if (guardianEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guardianEmail)) {
      errors.push({
        row: rowIndex,
        field: 'guardianEmail',
        value: guardianEmail,
        message: 'Invalid guardian email format',
      });
    }
  }

  return errors;
}

// Check for duplicate student IDs in the import batch
function findDuplicateStudentIds(
  records: Record<string, unknown>[]
): Set<string> {
  const seenIds = new Set<string>();
  const duplicates = new Set<string>();

  for (const record of records) {
    const studentId = String(record.studentId || '').trim().toLowerCase();
    if (studentId) {
      if (seenIds.has(studentId)) {
        duplicates.add(studentId);
      }
      seenIds.add(studentId);
    }
  }

  return duplicates;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const tenantId = session.tenantId;
    const body = await req.json();
    
    // Support both array and wrapped format
    const records: Record<string, unknown>[] = Array.isArray(body) 
      ? body 
      : (body.students || body.records || []);

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ 
        error: 'No student records provided. Please provide an array of students.',
        format: {
          example: [{ studentId: "STU001", firstName: "John", lastName: "Doe", gender: "Male", className: "Primary 1", guardianName: "Jane Doe", guardianPhone: "0241234567" }],
          fields: {
            required: ['studentId', 'firstName', 'lastName'],
            optional: ['gender', 'dateOfBirth', 'className', 'guardianName', 'guardianPhone', 'guardianEmail', 'address']
          }
        }
      }, { status: 400 });
    }

    // Limit batch size to prevent timeout
    const MAX_BATCH_SIZE = 500;
    if (records.length > MAX_BATCH_SIZE) {
      return NextResponse.json({
        error: `Batch too large. Maximum ${MAX_BATCH_SIZE} students per import.`,
        currentSize: records.length
      }, { status: 400 });
    }

    // Check tenant quota before proceeding
    const quota = await verifyTenantStudentQuota(tenantId);
    
    // Get existing student IDs for duplicate check
    const existingStudents = await prisma.student.findMany({
      where: { tenantId },
      select: { studentId: true },
    });
    const existingStudentIds = new Set(existingStudents.map(s => s.studentId.toLowerCase()));

    // Find duplicates within the import batch
    const batchDuplicates = findDuplicateStudentIds(records);

    // Validate all records first
    const allErrors: ValidationError[] = [];
    const validRecords: Array<{
      record: Record<string, unknown>;
      rowIndex: number;
      classId: string | null;
    }> = [];

    // Get existing classes for class name mapping
    const existingClasses = await prisma.class.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const classMap = new Map<string, string>();
    existingClasses.forEach(c => classMap.set(c.name.toLowerCase(), c.id));

    let recordsWithDateOfBirth = 0;
    let recordsWithClass = 0;
    let recordsWithGuardian = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 2; // +2 to account for 0-index and header row

      // Skip completely empty rows
      const firstName = String(record.firstName || '').trim();
      const lastName = String(record.lastName || '').trim();
      const studentId = String(record.studentId || '').trim();
      
      if (!firstName && !lastName && !studentId) {
        continue;
      }

      // Validate record
      const errors = validateStudentRecord(record, rowNum, existingStudentIds);
      
      // Check for batch duplicate
      if (batchDuplicates.has(studentId.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: 'studentId',
          value: studentId,
          message: 'Duplicate student ID in import batch',
        });
      }

      // Check for existing student
      if (existingStudentIds.has(studentId.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: 'studentId',
          value: studentId,
          message: 'Student ID already exists in database',
        });
      }

      if (errors.length > 0) {
        allErrors.push(...errors);
      } else {
        // Find class ID if class name provided
        const className = String(record.className || record.class || '').trim().toLowerCase();
        const classId = className ? classMap.get(className) || null : null;

        validRecords.push({ record, rowIndex: rowNum, classId });

        // Track summary stats
        if (record.dateOfBirth) recordsWithDateOfBirth++;
        if (classId) recordsWithClass++;
        if (record.guardianName) recordsWithGuardian++;
      }
    }

    // If there are validation errors, return them without importing
    if (allErrors.length > 0) {
      return NextResponse.json({
        success: false,
        totalRows: records.length,
        imported: 0,
        skipped: records.length,
        errors: allErrors.slice(0, 100), // Limit errors returned
        errorCount: allErrors.length,
        message: `Validation failed: ${allErrors.length} error(s) found.`,
        canImport: false
      }, { status: 400 });
    }

    // Check quota
    const availableQuota = quota.limit - quota.currentCount;
    if (validRecords.length > availableQuota) {
      return NextResponse.json({
        success: false,
        error: `Quota exceeded. You can only import ${availableQuota} more students (current: ${quota.currentCount}/${quota.limit}).`,
        availableQuota,
        requestedImport: validRecords.length,
        upgradeRequired: true
      }, { status: 403 });
    }

    // Import valid records
    let imported = 0;
    const duplicateStudentIds: string[] = [];

    for (const { record, classId } of validRecords) {
      const studentId = String(record.studentId || '').trim();
      
      // Skip if duplicate in batch (already handled above, but double-check)
      if (batchDuplicates.has(studentId.toLowerCase())) {
        duplicateStudentIds.push(studentId);
        continue;
      }

      try {
        await prisma.student.create({
          data: {
            tenantId,
            studentId,
            firstName: String(record.firstName || '').trim(),
            lastName: String(record.lastName || '').trim(),
            gender: record.gender 
              ? String(record.gender).trim() 
              : 'Not Specified',
            dateOfBirth: record.dateOfBirth 
              ? new Date(record.dateOfBirth as string) 
              : null,
            classId: classId || null,
            guardianName: record.guardianName 
              ? String(record.guardianName).trim() 
              : null,
            guardianPhone: record.guardianPhone 
              ? String(record.guardianPhone).trim() 
              : null,
            guardianEmail: record.guardianEmail 
              ? String(record.guardianEmail).trim() 
              : null,
            address: record.address 
              ? String(record.address).trim() 
              : null,
            status: 'ACTIVE',
          },
        });
        imported++;
      } catch (error: unknown) {
        // Handle duplicate key error gracefully
        if (error && typeof error === 'object' && (error as Record<string, unknown>).code === 'P2002') {
          duplicateStudentIds.push(studentId);
        } else {
          console.error(`Error importing student ${studentId}:`, error);
        }
      }
    }

    const result: ImportResult = {
      success: true,
      totalRows: records.length,
      imported,
      skipped: records.length - imported,
      errors: [],
      summary: {
        withDateOfBirth: recordsWithDateOfBirth,
        withClass: recordsWithClass,
        withGuardian: recordsWithGuardian,
        duplicateStudentIds,
      },
    };

    return NextResponse.json({
      ...result,
      message: imported > 0 
        ? `Successfully imported ${imported} student(s). ${result.skipped > 0 ? `${result.skipped} skipped due to duplicates or errors.` : ''}`
        : 'No students were imported.',
    });
  } catch (error: unknown) {
    console.error('Student import error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Server error during import'
    }, { status: 500 });
  }
}

// GET endpoint to provide import template
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    // Get classes for reference
    const classes = await prisma.class.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      template: {
        csvHeaders: [
          'studentId (required)',
          'firstName (required)',
          'lastName (required)',
          'gender (optional)',
          'dateOfBirth (optional, YYYY-MM-DD)',
          'className (optional)',
          'guardianName (optional)',
          'guardianPhone (optional)',
          'guardianEmail (optional)',
          'address (optional)'
        ],
        exampleRow: {
          studentId: 'STU001',
          firstName: 'John',
          lastName: 'Doe',
          gender: 'Male',
          dateOfBirth: '2015-05-15',
          className: 'Primary 1',
          guardianName: 'Jane Doe',
          guardianPhone: '0241234567',
          guardianEmail: 'jane@example.com',
          address: '123 Main Street, Accra'
        },
        validationRules: {
          studentId: 'Unique, 2+ characters, alphanumeric with - and _ allowed',
          firstName: 'Required, 2+ characters, letters only',
          lastName: 'Required, 2+ characters, letters only',
          gender: 'Optional: Male, Female, Other, or Not Specified',
          dateOfBirth: 'Optional, must be valid date, student age between 3-25 years',
          className: 'Optional, must match existing class name',
          guardianPhone: 'Optional, valid Ghana phone format',
          guardianEmail: 'Optional, valid email format'
        },
        availableClasses: classes,
        batchLimit: 500
      }
    });
  } catch (error: unknown) {
    console.error('Template fetch error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Server error'
    }, { status: 500 });
  }
}