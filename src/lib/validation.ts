import { z } from 'zod';

/**
 * Validation schemas for API request payloads
 * Ensures data integrity and prevents invalid data from entering the system
 */

// Enums from Prisma schema
export const AttendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);
export const RoleEnum = z.enum(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'BURSAR', 'TEACHER', 'VIEWER', 'PARENT']);

// Student validation schema
export const StudentSchema = z.object({
  studentId: z.string().max(50).optional(),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  gender: z.string().optional(),
  dateOfBirth: z.string().datetime().optional().or(z.string().length(0)).transform(val => val || undefined),
  classId: z.string().optional(),
  guardianName: z.string().max(200).optional(),
  guardianPhone: z.string().max(20).optional(),
  guardianEmail: z.string().email('Invalid email format').optional().or(z.string().length(0)),
  address: z.string().max(500).optional(),
  photoUrl: z.string().url().optional().or(z.string().length(0)),
  status: z.string().optional(),
});

// Invoice validation schema
export const InvoiceSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  academicYearId: z.string().min(1, 'Academic year is required'),
  term: z.string().min(1, 'Term is required'),
  totalAmount: z.number()
    .positive('Total amount must be positive')
    .max(999999.99, 'Amount exceeds maximum allowed'),
  paidAmount: z.number()
    .nonnegative('Paid amount cannot be negative')
    .max(999999.99, 'Amount exceeds maximum allowed')
    .optional(),
  dueDate: z.string().datetime().optional().or(z.string().length(0)).transform(val => val || undefined),
  itemsJson: z.any().optional(),
});

// Payment validation schema
export const PaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number()
    .positive('Payment amount must be positive')
    .max(999999.99, 'Amount exceeds maximum allowed'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  transactionRef: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// Attendance validation schema
export const AttendanceSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  academicYearId: z.string().min(1, 'Academic year ID is required'),
  term: z.string().min(1, 'Term is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  status: AttendanceStatusEnum,
  notes: z.string().max(500).optional(),
});

// Performance validation schema
export const PerformanceSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  term: z.string().min(1, 'Term is required'),
  academicYear: z.string().min(1, 'Academic year is required'),
  course: z.string().min(1, 'Course is required'),
  classScore: z.number()
    .min(0, 'Score cannot be negative')
    .max(100, 'Score cannot exceed 100'),
  examScore100: z.number()
    .min(0, 'Score cannot be negative')
    .max(100, 'Score cannot exceed 100'),
  examScore60: z.number()
    .min(0, 'Score cannot be negative')
    .max(60, 'Score cannot exceed 60'),
  total: z.number()
    .min(0, 'Total cannot be negative')
    .max(100, 'Total cannot exceed 100'),
  grade: z.string().optional(),
  rank: z.string().optional(),
  remarks: z.string().max(500).optional(),
});

// Login validation schema
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  subdomain: z.string().min(1, 'Subdomain is required').optional(),
});

// User/Registration validation schema
export const UserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  fullName: z.string().min(2, 'Full name is required').max(200, 'Name too long'),
  role: RoleEnum.optional(),
  phone: z.string().max(20).optional(),
});

// Class validation schema
export const ClassSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(100),
  classTeacherId: z.string().optional(),
  academicYearId: z.string().optional(),
});

// Academic Year validation schema
export const AcademicYearSchema = z.object({
  year: z.string().min(1, 'Year is required').max(50),
  status: z.string().optional(),
  currentTerm: z.string().optional(),
});

// Teacher validation schema
export const TeacherSchema = z.object({
  teacherId: z.string().max(50).optional(),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email format').optional().or(z.string().length(0)),
  classId: z.string().optional(),
  className: z.string().optional(),
  academicYear: z.string().optional(),
  status: z.string().optional(),
});

// Parent validation schema
export const ParentSchema = z.object({
  parentName: z.string().min(1, 'Parent name is required').max(200),
  studentId: z.string().min(1, 'Student ID is required'),
  relationship: z.string().max(50).optional(),
  isPrimary: z.boolean().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email format').optional().or(z.string().length(0)),
});

/**
 * Helper to format Zod validation errors for API responses
 */
export function formatZodErrors(error: z.ZodError<any>): string[] {
  return error.issues.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}
