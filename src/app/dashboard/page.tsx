'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ImportStudentsModal from './ImportStudentsModal';
import * as XLSX from 'xlsx';
import {
  SUBSCRIPTION_PLANS,
  SubscriptionStatusInfo,
  calculateSubscriptionStatus,
  getPlanPrice,
  getBillingCycleDays,
} from '@/lib/subscriptions';
import {
  PERM_ACTIONS,
  PERM_PAGES,
  PERM_ROLES,
  PERM_SECTIONS,
  PERM_ACTION_LABELS,
  permRoleLabel,
  parsePermPolicy,
  type PermAction,
  type PermPolicy,
} from '@/lib/permissions';
import {
  DEPARTMENTS,
  DEPARTMENT_RESOURCES,
  getResourceByTab,
} from '@/lib/departments';
import DepartmentWorkspace from './departments/DepartmentWorkspace';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';
import useSessionGuard from '@/hooks/useSessionGuard';
import SessionTimeoutDialog from '@/components/SessionTimeoutDialog';
import SessionCheckingScreen from '@/components/SessionCheckingScreen';
import { readTenant } from '@/lib/session';

interface TenantInfo {
  id: string;
  name: string;
  alias?: string;
  subdomain: string;
  currency?: string;
  plan: string;
  studentLimit: number;
  status?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  customDomain?: string;
  subscription?: {
    plan: string;
    status: string;
    daysRemaining: number;
    isExpiringSoon: boolean;
    isExpired: boolean;
    currentPeriodEnd: string;
    billingCycle: string;
  };
}

interface SubscriptionRecord {
  id: string;
  plan: string;
  studentLimit: number;
  amount: number;
  currency: string;
  billingCycle: string;
  status: string;
  paymentGateway: string;
  gatewayReference?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
}

interface SubscriptionData {
  tenant: TenantInfo;
  currentSubscription: SubscriptionRecord | null;
  statusInfo: SubscriptionStatusInfo;
  usage: {
    studentCount: number;
    studentLimit: number;
    quotaPercentage: number;
    remainingSlots: number;
  };
  plans: Array<{
    key: string;
    name: string;
    studentLimit: number;
    priceMonthly: number;
    priceTermly: number;
    priceAnnual: number;
    popular?: boolean;
    description: string;
    features: string[];
  }>;
  history: SubscriptionRecord[];
}

interface UserInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gender?: string;
  guardianName?: string;
  guardianPhone?: string;
  status: string;
  createdAt: string;
  class?: { name: string };
}

interface Teacher {
  id: string;
  teacherId: string;
  firstName: string;
  lastName: string;
  className?: string;
  academicYear?: string;
  status: string;
  createdAt: string;
}

interface UserRecord {
  id: string;
  email: string;
  username?: string | null;
  fullName: string;
  role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'BURSAR' | 'TEACHER' | 'VIEWER' | 'PARENT';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  phone?: string | null;
  createdAt: string;
}

interface ParentRecord {
  id: string;
  mappingId: string;
  parentUserId?: string | null;
  parentName: string;
  studentId: string;
  student?: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
  } | null;
  parentUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  relationship?: string | null;
  isPrimary: boolean;
  billing?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
}

interface PermissionRecord {
  id: string;
  role: string;
  accessLevel: string;
  actions: string;
  createdAt: string;
}

interface Subject {
  id: string;
  code?: string | null;
  name: string;
  instructorName?: string | null;
  credits: number;
  semester?: string | null;
  status: string;
  createdAt: string;
}

interface AcademicYearRecord {
  id: string;
  year: string;
  status: string;
  currentTerm: string;
  createdAt: string;
  _count?: { classes: number; invoices: number; attendance: number };
}

interface ClassRecord {
  id: string;
  name: string;
  classTeacherId?: string | null;
  classTeacher?: { id: string; fullName: string; email: string } | null;
  _count?: { students: number; teachers: number };
  createdAt: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  academicYearId: string;
  term: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  notes?: string | null;
  createdAt: string;
  student?: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
  } | null;
  class?: {
    id: string;
    name: string;
  } | null;
  academicYear?: {
    id: string;
    year: string;
  } | null;
}

interface PerformanceRecord {
  id: string;
  performanceId?: string | null;
  studentId: string;
  studentName?: string | null;
  studentClass?: string | null;
  term: string;
  academicYear: string;
  course: string;
  classScore: number | string;
  examScore100: number | string;
  examScore60: number | string;
  total: number | string;
  grade?: string | null;
  rank?: string | null;
  remarks?: string | null;
  createdAt: string;
  student?: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  studentId: string;
  student?: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
    classId?: string | null;
    class?: {
      id: string;
      name: string;
    } | null;
  } | null;
  academicYearId: string;
  academicYear?: {
    id: string;
    year: string;
    status: string;
  } | null;
  term: string;
  category?: string;
  items?: string;
  issueDate?: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'CANCELLED';
  dueDate?: string | null;
  isOverdue?: boolean;
  payments?: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    receiptNumber: string;
    createdAt: string;
  }>;
  createdAt: string;
}

interface PaymentRecord {
  id: string;
  transactionId: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  categoryName?: string;
  studentDbId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentClassId: string;
  academicYear: string;
  academicYearId: string;
  term: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: string;
  referenceNo: string;
  notes: string;
  balance: number;
  invoiceTotal: number;
  invoicePaid: number;
  balanceStatus: 'Paid' | 'Part Payment' | 'No Payment';
  recordedBy: string;
  createdAt: string;
}

interface SystemParamItem {
  id: string;
  param: string;
  value: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TenantAuditLogItem {
  id: string;
  action: string;
  entity: string;
  details?: string | null;
  createdAt: string;
  user?: {
    fullName: string;
    email: string;
    role: string;
  } | null;
}

interface TenantSettingsData {
  tenant: TenantInfo | null;
  parameters: SystemParamItem[];
  scorePercentages: {
    classScore: number;
    examScore: number;
    passingMark: number;
  };
  lists: {
    categories: string[];
    methods: string[];
    statuses: string[];
  };
  stats?: {
    studentsCount: number;
    teachersCount: number;
    classesCount: number;
    invoicesCount: number;
    paymentsCount: number;
    attendanceCount?: number;
    performanceCount?: number;
  };
  auditLogs?: TenantAuditLogItem[];
}

interface BillingItem {
  id: string;
  billingId: string;
  item: string;
  amount: number | string;
  status: string;
  description?: string;
  createdAt: string;
}

interface BillingCategoryItem {
  id: string;
  categoryId?: string;
  name: string;
  academicYear?: string;
  term?: string;
  items?: string;
  totalAmount: number | string;
  description?: string;
  createdAt: string;
}

// ── Reports interfaces ────────────────────────────────────────────────────────
interface ReportKPIs {
  totalStudents: number;
  teacherCount: number;
  totalRevenue: number;
  outstanding: number;
  avgPerformance: number;
  attendanceRate: number;
}
interface ReportEnrollmentItem { classId: string; className: string; studentCount: number; }
interface ReportBillingStatus { paid: number; partial: number; unpaid: number; cancelled: number; total: number; }
interface ReportTopPerformer { studentId: string; name: string; className: string; avgScore: number; grade: string; }
interface ReportSubjectAvg { course: string; avgScore: number; count: number; }
interface ReportDebtor { invoiceNumber: string; studentName: string; studentClass: string; totalAmount: number; amountPaid: number; balance: number; status: string; }
interface ReportInvoiceRow { invoiceNumber: string; studentName: string; studentClass: string; totalAmount: number; amountPaid: number; balance: number; status: string; createdAt: string; }
interface ReportAttendanceSummary { total: number; present: number; absent: number; late: number; excused: number; rate: number; }
interface ReportsData {
  filters: { activeYear: string; activeTerm: string; availableYears: { id: string; year: string; status: string }[]; availableClasses: { id: string; name: string }[] };
  kpis: ReportKPIs;
  enrollmentByClass: ReportEnrollmentItem[];
  billingStatus: ReportBillingStatus;
  topPerformers: ReportTopPerformer[];
  subjectAverages: ReportSubjectAvg[];
  recentInvoices: ReportInvoiceRow[];
  debtors: ReportDebtor[];
  attendance: ReportAttendanceSummary;
  genderBreakdown: Record<string, number>;
}
// ── End Reports interfaces ────────────────────────────────────────────────────

interface StatsData {
  studentCount: number;
  studentLimit: number;
  quotaPercentage: number;
  classCount: number;
  subjectCount: number;
  staffCount: number;
  billingCategoryCount: number;
  activeYear: string;
  currentTerm: string;
}

interface DashboardKPIs {
  totalStudents: number;
  activeSubjects: number;
  averageAttendance: string;
  totalInvoices: number;
}

interface PaymentStatusItem {
  className: string;
  paidStudents: number;
  unpaidStudents: number;
}

interface AttendanceTrendItem {
  label: string;
  percentage: number;
}

interface StudentsByClassItem {
  className: string;
  studentCount: number;
}

interface QuickInsightsData {
  invoicesCount: number;
  paidInvoices: number;
  partialInvoices: number;
  unpaidInvoices: number;
  totalBilled: number;
  paymentsCount: number;
  collectedAmount: number;
  collectedPercentage: number;
  outstandingAmount: number;
  outstandingPercentage: number;
}

interface AcademicYearOption {
  id: string;
  year: string;
  status: string;
  currentTerm: string;
}


// Sidebar SVG Icons matching design
const DashboardIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 14l4-4 4 4 5-6" />
  </svg>
);

const StudentsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const TeachersIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6zm5 8c1.38 0 2.5-1.12 2.5-2.5S10.38 9 9 9s-2.5 1.12-2.5 2.5S7.62 14 9 14zm4.5 0h2v-1.5h-2V14zm0-2.5h2V10h-2v1.5z" />
  </svg>
);

const UsersIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const ParentsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2a2 2 0 100 4 2 2 0 000-4zm-4 7c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v5h-2v7h-4v-7H8V9z" />
  </svg>
);

const PermissionsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
  </svg>
);

const ClassesIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9.07l-9-7-9 7 1.63 1.27L12 16z" />
  </svg>
);

const SubjectIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
  </svg>
);

const EnrollmentsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const AttendanceIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

const AcademicYearsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
  </svg>
);

const PerformanceIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const InvoicesIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
  </svg>
);

const PaymentsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
  </svg>
);

const BillingsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1.5 14.5v-1.07c-1.04-.18-1.85-.81-1.98-1.82h1.4c.1.52.54.89 1.18.89.69 0 1.15-.36 1.15-.89 0-.58-.45-.8-1.46-1.04-1.39-.32-2.14-.92-2.14-2.07 0-1.06.82-1.74 1.85-1.91V7h1.5v1.03c.89.15 1.58.68 1.76 1.57h-1.37c-.12-.48-.52-.77-1.04-.77-.63 0-1.05.35-1.05.84 0 .5.4.73 1.34.97 1.48.37 2.26.96 2.26 2.14 0 1.13-.88 1.82-1.95 1.99v1.03h-1.45zM13 9V3.5L18.5 9H13z" />
  </svg>
);

const BillingCategoriesIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    <circle cx="2" cy="6" r="1" fill="currentColor" />
    <circle cx="2" cy="12" r="1" fill="currentColor" />
    <circle cx="2" cy="18" r="1" fill="currentColor" />
  </svg>
);

const SettingsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
);

const ReportsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const MigrationIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SubscriptionIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const ChevronDownIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
  </svg>
);

/**
 * Sidebar icons for the Operations & Marketing department pages, keyed by the
 * resource key declared in `src/lib/departments.ts`.
 */
const DEPARTMENT_ICON_PATHS: Record<string, string[]> = {
  assets: ['M3 7l9-4 9 4-9 4-9-4z', 'M3 7v10l9 4 9-4V7', 'M12 11v10'],
  requisitions: ['M9 4h6v3H9z', 'M9 5.5H6.5v15h11v-15H15', 'M9 12h6', 'M9 16h4'],
  'work-orders': [
    'M12 9.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6z',
    'M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21',
    'M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6',
  ],
  transport: ['M5 17V7a2 2 0 012-2h10a2 2 0 012 2v10', 'M3.5 17h17', 'M7 20h2M15 20h2', 'M6.5 9.5h11', 'M8 13.2h1.6M14.4 13.2H16'],
  vendors: ['M4.5 9.5h15V20h-15z', 'M3 9.5L4.6 5h14.8L21 9.5', 'M9.5 20v-5.5h5V20'],
  campaigns: ['M4 10v4h3.2L14 18V6L7.2 10H4z', 'M17.5 9.2a3.6 3.6 0 010 5.6'],
  leads: [
    'M12 3.2a8.8 8.8 0 100 17.6 8.8 8.8 0 000-17.6z',
    'M12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4z',
    'M12 11.4a.6.6 0 100 1.2.6.6 0 000-1.2z',
  ],
  announcements: ['M12 3.2a6 6 0 00-6 6v3.6L4 16h16l-2-3.2V9.2a6 6 0 00-6-6z', 'M10 19a2 2 0 004 0'],
  events: ['M4.5 6.2h15V20.5h-15z', 'M4.5 10.4h15', 'M8.5 3.5v4M15.5 3.5v4', 'M12 13l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L8.8 15.3 11 15l1-2z'],
  referrals: [
    'M17.8 4.6a2.1 2.1 0 100 4.2 2.1 2.1 0 000-4.2z',
    'M6.2 9.9a2.1 2.1 0 100 4.2 2.1 2.1 0 000-4.2z',
    'M17.8 15.2a2.1 2.1 0 100 4.2 2.1 2.1 0 000-4.2z',
    'M8.1 11l7.6-3.6M8.1 13l7.6 3.6',
  ],
};

const DepartmentNavIcon = ({
  resourceKey,
  className = 'w-5 h-5',
}: {
  resourceKey: string;
  className?: string;
}) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    {(DEPARTMENT_ICON_PATHS[resourceKey] ?? []).map((d, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
    ))}
  </svg>
);

/**
 * Collapsible sidebar section. Every group is a dropdown that starts CLOSED;
 * a blue dot marks a collapsed group that contains the page you are on.
 */
const SidebarGroup = ({
  label,
  groupKey,
  open,
  hasActive,
  onToggle,
  children,
}: {
  label: string;
  groupKey: string;
  open: boolean;
  hasActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`nav-group-${groupKey}`}
      className="group w-full flex items-center justify-between gap-2 px-1 pb-1.5 mb-2 border-b border-slate-100 transition"
    >
      <span
        className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
          open || hasActive ? 'text-slate-600' : 'text-slate-400'
        } group-hover:text-slate-700`}
      >
        {label}
        {!open && hasActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
      </span>
      <ChevronDownIcon
        className={`w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
          open ? 'rotate-180' : ''
        }`}
      />
    </button>
    {open && (
      <div id={`nav-group-${groupKey}`} className="space-y-0.5 pb-1 animate-in fade-in slide-in-from-top-1 duration-150">
        {children}
      </div>
    )}
  </div>
);

export default function Dashboard() {
  const { isDark: darkMode } = useTheme();

  // ---- SESSION / AUTHENTICATION --------------------------------------------
  // The dashboard only renders once the stored token has been verified by the
  // server (signature, expiry, account status). The guard also tracks the
  // user's last activity and signs them out after the inactivity window, so a
  // token left behind in localStorage can no longer re-open this page.
  const session = useSessionGuard({ redirectTo: '/' });

  // `session.token` is the live token: it is slid forward while the user is
  // active, so every request below stays authorised.
  const token = session.token;
  const user = (session.user as UserInfo | null) ?? null;

  // Seeded from the last known school, then kept fresh by the dashboard's own
  // data loads (stats / profile updates).
  const [tenant, setTenant] = useState<TenantInfo | null>(
    () => (readTenant() as TenantInfo | null) ?? null
  );
  const [activeTab, setActiveTab] = useState<string>('overview');
  // Sidebar dropdown groups (PEOPLE / ACADEMICS / FINANCE / OPERATIONS /
  // MARKETING / SYSTEM). Every group is CLOSED by default — a group only opens
  // when the user clicks it, or when navigation lands on a page inside it.
  const [openNavGroups, setOpenNavGroups] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Stats & Students state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Billing state
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [billingCategories, setBillingCategories] = useState<BillingCategoryItem[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSubTab, setBillingSubTab] = useState<'items' | 'categories'>('items');
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);

  // New Billing Item Form
  const [newItemForm, setNewItemForm] = useState({
    item: '',
    amount: '',
    status: 'Active',
    description: '',
  });
  const [createItemLoading, setCreateItemLoading] = useState(false);
  const [itemError, setItemError] = useState('');

  // New Billing Category Form
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    academicYear: '',
    term: 'Term 1',
    description: '',
  });
  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  // Modals & UI states
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Subscription state
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'termly' | 'annual'>('monthly');
  const [paywallCycle, setPaywallCycle] = useState<'monthly' | 'termly' | 'annual'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<string | null>(null);
  const [selectedPaywallPlan, setSelectedPaywallPlan] = useState<string>('SILVER');
  const [receiptModalSub, setReceiptModalSub] = useState<SubscriptionRecord | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [subscriptionToast, setSubscriptionToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filter and Analytics States
  const [availableYears, setAvailableYears] = useState<AcademicYearOption[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('All Terms');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // KPIs & Chart states
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [paymentStatusData, setPaymentStatusData] = useState<PaymentStatusItem[]>([]);
  const [attendanceTrendData, setAttendanceTrendData] = useState<AttendanceTrendItem[]>([]);
  const [studentsByClassData, setStudentsByClassData] = useState<StudentsByClassItem[]>([]);
  const [quickInsights, setQuickInsights] = useState<QuickInsightsData | null>(null);


  // New Student Form
  const [enrollForm, setEnrollForm] = useState({
    firstName: '',
    lastName: '',
    studentId: '',
    gender: 'Male',
    dateOfBirth: '',
    classId: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
  });
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState('');

  // Migration form
  const [migrationPayload, setMigrationPayload] = useState('');
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  // Student Import form
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPayload, setImportPayload] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    totalRows: number;
    imported: number;
    skipped: number;
    errors: Array<{ row: number; field: string; message: string }>;
    summary: { withDateOfBirth: number; withClass: number; withGuardian: number };
  } | null>(null);
  const [importTemplate, setImportTemplate] = useState<{
    csvHeaders: string[];
    exampleRow: Record<string, string>;
    validationRules: Record<string, string>;
    availableClasses: Array<{ id: string; name: string }>;
  } | null>(null);

  // Teachers CRUD state
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teachersFetched, setTeachersFetched] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    className: '',
    academicYear: '',
  });
  const [teacherFormLoading, setTeacherFormLoading] = useState(false);
  const [teacherFormError, setTeacherFormError] = useState('');
  const [showDeleteTeacherModal, setShowDeleteTeacherModal] = useState(false);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [deleteTeacherLoading, setDeleteTeacherLoading] = useState(false);

  // Subjects CRUD state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [subjectStatusFilter, setSubjectStatusFilter] = useState('All Statuses');
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [subjectsFetched, setSubjectsFetched] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    instructor: '',
    credits: '1',
    semester: '',
    status: 'Active',
  });
  const [subjectFormLoading, setSubjectFormLoading] = useState(false);
  const [subjectFormError, setSubjectFormError] = useState('');
  const [showDeleteSubjectModal, setShowDeleteSubjectModal] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [deleteSubjectLoading, setDeleteSubjectLoading] = useState(false);
  const [subjectNotice, setSubjectNotice] = useState('');

  // Academic Years CRUD state
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [yearSearchQuery, setYearSearchQuery] = useState('');
  const [yearLoading, setYearLoading] = useState(false);
  const [yearsFetched, setYearsFetched] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYearRecord | null>(null);
  const [yearForm, setYearForm] = useState({
    year: '',
    status: 'Active',
    currentTerm: 'Term 1',
  });
  const [yearFormLoading, setYearFormLoading] = useState(false);
  const [yearFormError, setYearFormError] = useState('');
  const [showDeleteYearModal, setShowDeleteYearModal] = useState(false);
  const [deletingYear, setDeletingYear] = useState<AcademicYearRecord | null>(null);
  const [deleteYearLoading, setDeleteYearLoading] = useState(false);
  const [yearNotice, setYearNotice] = useState('');

  // Users CRUD state
  const [systemUsers, setSystemUsers] = useState<UserRecord[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [usersFetched, setUsersFetched] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    fullName: '',
    username: '',
    password: '',
    role: 'TEACHER',
    status: 'ACTIVE',
  });
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [userNotice, setUserNotice] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Parents CRUD state
  const [parentMappings, setParentMappings] = useState<ParentRecord[]>([]);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [parentLoading, setParentLoading] = useState(false);
  const [parentsFetched, setParentsFetched] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);
  const [editingParent, setEditingParent] = useState<ParentRecord | null>(null);
  const [parentForm, setParentForm] = useState({
    parentName: '',
    parentUserId: '',
    studentId: '',
    relationship: 'Mother',
    isPrimary: false,
    billing: 'No',
    phone: '',
    email: '',
  });
  const [parentFormLoading, setParentFormLoading] = useState(false);
  const [parentFormError, setParentFormError] = useState('');
  const [showDeleteParentModal, setShowDeleteParentModal] = useState(false);
  const [deletingParent, setDeletingParent] = useState<ParentRecord | null>(null);
  const [deleteParentLoading, setDeleteParentLoading] = useState(false);
  const [parentNotice, setParentNotice] = useState('');

  // Permissions CRUD state
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [permissionSearchQuery, setPermissionSearchQuery] = useState('');
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionsFetched, setPermissionsFetched] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [editingPermission, setEditingPermission] = useState<PermissionRecord | null>(null);
  // Form state: role + access level + the checkbox matrix (pageKey -> actions)
  const [permissionForm, setPermissionForm] = useState<{
    role: string;
    accessLevel: string;
    checks: PermPolicy;
  }>({
    role: '',
    accessLevel: 'Full Access',
    checks: {},
  });
  // Legacy free-text actions of a record being edited (before the checkbox UI existed)
  const [permissionFormLegacyText, setPermissionFormLegacyText] = useState('');
  const [permissionFormLoading, setPermissionFormLoading] = useState(false);
  const [permissionFormError, setPermissionFormError] = useState('');
  const [showDeletePermissionModal, setShowDeletePermissionModal] = useState(false);
  const [deletingPermission, setDeletingPermission] = useState<PermissionRecord | null>(null);
  const [deletePermissionLoading, setDeletePermissionLoading] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState('');

  // Effective permission policy of the CURRENTLY logged-in user (drives the sidebar)
  const [permPolicy, setPermPolicy] = useState<PermPolicy | null>(null);
  const [permPolicyLoaded, setPermPolicyLoaded] = useState(false);

  // Classes CRUD state
  const [classesList, setClassesList] = useState<ClassRecord[]>([]);
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [classLoading, setClassLoading] = useState(false);
  const [classesFetched, setClassesFetched] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);
  const [classForm, setClassForm] = useState({
    name: '',
  });
  const [classFormLoading, setClassFormLoading] = useState(false);
  const [classFormError, setClassFormError] = useState('');
  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassRecord | null>(null);
  const [deleteClassLoading, setDeleteClassLoading] = useState(false);
  const [classNotice, setClassNotice] = useState('');

  // Attendance CRUD state
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceFetched, setAttendanceFetched] = useState(false);
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [attendanceDateFilter, setAttendanceDateFilter] = useState('');
  const [attendanceClassFilter, setAttendanceClassFilter] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('');
  const [attendanceTermFilter, setAttendanceTermFilter] = useState('');
  const [attendanceNotice, setAttendanceNotice] = useState('');

  // Bulk Mark Attendance Modal state
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
  const [markAttendanceDate, setMarkAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [markAttendanceClassId, setMarkAttendanceClassId] = useState('');
  const [markAttendanceYearId, setMarkAttendanceYearId] = useState('');
  const [markAttendanceTerm, setMarkAttendanceTerm] = useState('Term 1');
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterStatusMap, setRosterStatusMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});
  const [rosterNotesMap, setRosterNotesMap] = useState<Record<string, string>>({});
  const [markAttendanceSubmitting, setMarkAttendanceSubmitting] = useState(false);
  const [markAttendanceError, setMarkAttendanceError] = useState('');

  // Edit Single Attendance Modal state
  const [showEditAttendanceModal, setShowEditAttendanceModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [editAttendanceStatus, setEditAttendanceStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('PRESENT');
  const [editAttendanceNotes, setEditAttendanceNotes] = useState('');
  const [editAttendanceLoading, setEditAttendanceLoading] = useState(false);
  const [editAttendanceError, setEditAttendanceError] = useState('');

  // Delete Attendance Modal state
  const [showDeleteAttendanceModal, setShowDeleteAttendanceModal] = useState(false);
  const [deletingAttendance, setDeletingAttendance] = useState<AttendanceRecord | null>(null);
  const [deleteAttendanceLoading, setDeleteAttendanceLoading] = useState(false);

  // Performance state
  const [performanceList, setPerformanceList] = useState<PerformanceRecord[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceFetched, setPerformanceFetched] = useState(false);
  const [performanceSearchQuery, setPerformanceSearchQuery] = useState('');
  const [performanceClassFilter, setPerformanceClassFilter] = useState('');
  const [performanceYearFilter, setPerformanceYearFilter] = useState('');
  const [performanceTermFilter, setPerformanceTermFilter] = useState('');
  const [performanceSubjectFilter, setPerformanceSubjectFilter] = useState('');
  const [performanceNotice, setPerformanceNotice] = useState('');

  // Add Performance Modal state
  const [showAddPerformanceModal, setShowAddPerformanceModal] = useState(false);
  const [perfSelectedClassId, setPerfSelectedClassId] = useState('');
  const [perfClassStudents, setPerfClassStudents] = useState<Student[]>([]);
  const [perfClassStudentsLoading, setPerfClassStudentsLoading] = useState(false);
  const [performanceForm, setPerformanceForm] = useState({
    studentId: '',
    studentClass: '',
    course: '',
    term: 'Term 1',
    academicYear: '',
    classScore: '',
    examScore100: '',
  });
  const [performanceFormLoading, setPerformanceFormLoading] = useState(false);
  const [performanceFormError, setPerformanceFormError] = useState('');

  // Edit Single Performance Modal state
  const [showEditPerformanceModal, setShowEditPerformanceModal] = useState(false);
  const [editingPerformance, setEditingPerformance] = useState<PerformanceRecord | null>(null);
  const [editPerformanceForm, setEditPerformanceForm] = useState({
    course: '',
    term: 'Term 1',
    academicYear: '',
    studentClass: '',
    classScore: '',
    examScore100: '',
  });
  const [editPerformanceLoading, setEditPerformanceLoading] = useState(false);
  const [editPerformanceError, setEditPerformanceError] = useState('');

  // Delete Performance Modal state
  const [showDeletePerformanceModal, setShowDeletePerformanceModal] = useState(false);
  const [deletingPerformance, setDeletingPerformance] = useState<PerformanceRecord | null>(null);
  const [deletePerformanceLoading, setDeletePerformanceLoading] = useState(false);

  // Bulk / Advanced Performance Entry Modal
  const [showBulkPerformanceModal, setShowBulkPerformanceModal] = useState(false);
  const [bulkYear, setBulkYear] = useState('');
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkTerm, setBulkTerm] = useState('Term 1');
  const [bulkCourse, setBulkCourse] = useState('');
  const [bulkStudents, setBulkStudents] = useState<{ id: string; studentId: string; firstName: string; lastName: string; classScore: string; examScore100: string; examScore50: string; total: string }[]>([]);
  const [bulkGridLoading, setBulkGridLoading] = useState(false);
  const [bulkSaveLoading, setBulkSaveLoading] = useState(false);
  const [bulkNotice, setBulkNotice] = useState('');

  // Import Performance CSV Modal
  const [showImportPerformanceModal, setShowImportPerformanceModal] = useState(false);
  interface CsvPerfRow { studentId: string; studentName: string; studentClass: string; term: string; academicYear: string; course: string; classScore: string; examScore100: string; }
  const [csvPerfRows, setCsvPerfRows] = useState<CsvPerfRow[]>([]);
  const [csvImportLoading, setCsvImportLoading] = useState(false);
  const [csvImportNotice, setCsvImportNotice] = useState('');

  // Terminal Report Modal
  const [showTerminalReportModal, setShowTerminalReportModal] = useState(false);
  const [termReportClass, setTermReportClass] = useState('');
  const [termReportTerm, setTermReportTerm] = useState('Term 1');
  const [termReportYear, setTermReportYear] = useState('');
  const [termReportStudents, setTermReportStudents] = useState<{ id: string; name: string; studentId: string; selected: boolean }[]>([]);
  const [termReportLoading, setTermReportLoading] = useState(false);

  // Invoices state
  const [invoicesList, setInvoicesList] = useState<InvoiceRecord[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesFetched, setInvoicesFetched] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceClassFilter, setInvoiceClassFilter] = useState('');
  const [invoiceYearFilter, setInvoiceYearFilter] = useState('');
  const [invoiceTermFilter, setInvoiceTermFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [invoiceNotice, setInvoiceNotice] = useState('');

  // Single Add Invoice Modal state
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [invSelectedClassId, setInvSelectedClassId] = useState('');
  const [invClassStudents, setInvClassStudents] = useState<Student[]>([]);
  const [invClassStudentsLoading, setInvClassStudentsLoading] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    studentId: '',
    academicYearId: '',
    term: 'Term 1',
    category: 'Tuition',
    items: '',
    totalAmount: '',
    paidAmount: '0',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
  });
  const [invoiceFormLoading, setInvoiceFormLoading] = useState(false);
  const [invoiceFormError, setInvoiceFormError] = useState('');

  // Bulk Class Invoice Generation Modal state
  const [showBulkInvoiceModal, setShowBulkInvoiceModal] = useState(false);
  const [bulkInvForm, setBulkInvForm] = useState({
    classId: '',
    academicYearId: '',
    term: 'Term 1',
    category: 'Tuition',
    items: '',
    totalAmount: '',
    dueDate: '',
  });
  const [bulkInvLoading, setBulkInvLoading] = useState(false);
  const [bulkInvError, setBulkInvError] = useState('');

  // Edit Invoice Modal state
  const [showEditInvoiceModal, setShowEditInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);
  const [editInvoiceForm, setEditInvoiceForm] = useState({
    academicYearId: '',
    term: 'Term 1',
    category: 'Tuition',
    items: '',
    totalAmount: '',
    paidAmount: '',
    issueDate: '',
    dueDate: '',
    status: 'UNPAID',
  });
  const [editInvoiceLoading, setEditInvoiceLoading] = useState(false);
  const [editInvoiceError, setEditInvoiceError] = useState('');

  // Delete Invoice Modal state
  const [showDeleteInvoiceModal, setShowDeleteInvoiceModal] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRecord | null>(null);
  const [deleteInvoiceLoading, setDeleteInvoiceLoading] = useState(false);

  // Payments state
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsFetched, setPaymentsFetched] = useState(false);
  const [paymentsNotice, setPaymentsNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [paymentsSearch, setPaymentsSearch] = useState('');
  const [paymentsYearFilter, setPaymentsYearFilter] = useState('');
  const [paymentsTermFilter, setPaymentsTermFilter] = useState('');
  const [paymentsClassFilter, setPaymentsClassFilter] = useState('');
  const [paymentsMethodFilter, setPaymentsMethodFilter] = useState('');
  const [paymentsStatusFilter, setPaymentsStatusFilter] = useState('');
  const [paymentsDateFromFilter, setPaymentsDateFromFilter] = useState('');
  const [paymentsDateToFilter, setPaymentsDateToFilter] = useState('');

  // Add Payment Modal state
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paySelectedClassId, setPaySelectedClassId] = useState('');
  const [payClassStudents, setPayClassStudents] = useState<Student[]>([]);
  const [payClassStudentsLoading, setPayClassStudentsLoading] = useState(false);
  const [payStudentInvoices, setPayStudentInvoices] = useState<InvoiceRecord[]>([]);
  const [payStudentInvoicesLoading, setPayStudentInvoicesLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    invoiceId: '',
    academicYearId: '',
    term: 'Term 1',
    paymentDate: new Date().toISOString().split('T')[0],
    amountPaid: '',
    paymentMethod: 'Cash',
    referenceNo: '',
    notes: '',
  });
  const [paymentFormLoading, setPaymentFormLoading] = useState(false);
  const [paymentFormError, setPaymentFormError] = useState('');

  // Edit Payment Modal state
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    amountPaid: '',
    paymentMethod: 'Cash',
    referenceNo: '',
    paymentDate: '',
    notes: '',
  });
  const [editPaymentLoading, setEditPaymentLoading] = useState(false);
  const [editPaymentError, setEditPaymentError] = useState('');

  // Delete Payment Modal state
  const [showDeletePaymentModal, setShowDeletePaymentModal] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<PaymentRecord | null>(null);
  const [deletePaymentLoading, setDeletePaymentLoading] = useState(false);

  // Receipt Preview / Print Modal state
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<PaymentRecord | null>(null);

  // Reports State
  const [reportsData, setReportsData] = useState<ReportsData | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsFetched, setReportsFetched] = useState(false);
  const [reportsActiveSubTab, setReportsActiveSubTab] = useState<'overview' | 'academic' | 'financial' | 'attendance'>('overview');
  const [reportFilterYear, setReportFilterYear] = useState('');
  const [reportFilterTerm, setReportFilterTerm] = useState('');
  const [reportFilterClass, setReportFilterClass] = useState('');

  // Per-Tenant Settings State
  const [settingsActiveSubTab, setSettingsActiveSubTab] = useState<'profile' | 'grading' | 'lists' | 'backup' | 'audit' | 'gateways'>('profile');
  const [tenantSettings, setTenantSettings] = useState<TenantSettingsData | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsFetched, setSettingsFetched] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Payment Gateways Settings State
  const [gatewaySettings, setGatewaySettings] = useState<{
    defaultGateway: 'paystack' | 'flutterwave' | 'stripe' | 'sandbox';
    currency: string;
    paystack: {
      enabled: boolean;
      mode: 'test' | 'live';
      publicKey: string;
      secretKey: string;
      hasSecretKey?: boolean;
      channels: string[];
    };
    flutterwave: {
      enabled: boolean;
      mode: 'test' | 'live';
      publicKey: string;
      secretKey: string;
      hasSecretKey?: boolean;
      encryptionKey: string;
      channels: string[];
    };
    stripe: {
      enabled: boolean;
      mode: 'test' | 'live';
      publicKey: string;
      secretKey: string;
      hasSecretKey?: boolean;
    };
  }>({
    defaultGateway: 'paystack',
    currency: 'GHS',
    paystack: { enabled: true, mode: 'test', publicKey: '', secretKey: '', channels: ['mobile_money', 'card'] },
    flutterwave: { enabled: true, mode: 'test', publicKey: '', secretKey: '', encryptionKey: '', channels: ['mobilemoneyghana', 'card', 'banktransfer', 'ussd'] },
    stripe: { enabled: false, mode: 'test', publicKey: '', secretKey: '' },
  });
  const [gatewaysLoading, setGatewaysLoading] = useState(false);
  const [gatewaysSaving, setGatewaysSaving] = useState(false);
  const [gatewaysNotice, setGatewaysNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [selectedCheckoutGateway, setSelectedCheckoutGateway] = useState<'paystack' | 'flutterwave' | 'stripe' | 'sandbox'>('paystack');

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    alias: '',
    logoUrl: '',
    address: '',
    email: '',
    phone: '',
    currency: 'GHS',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const sidebarLogoInputRef = useRef<HTMLInputElement>(null);
  const profileLogoInputRef = useRef<HTMLInputElement>(null);

  // Grading Weights Form state
  const [gradingForm, setGradingForm] = useState({
    classScore: 50,
    examScore: 50,
    passingMark: 50,
  });
  const [gradingSaving, setGradingSaving] = useState(false);

  // Edit Parameter Modal state
  const [showEditParamModal, setShowEditParamModal] = useState(false);
  const [editingParam, setEditingParam] = useState<{ param: string; value: string; category?: string } | null>(null);
  const [editParamValue, setEditParamValue] = useState('');
  const [editParamLoading, setEditParamLoading] = useState(false);

  // Add/Edit System List Item Modal state
  const [showListModal, setShowListModal] = useState(false);
  const [listModalType, setListModalType] = useState<'categories' | 'methods'>('categories');
  const [listModalOldValue, setListModalOldValue] = useState<string | null>(null);
  const [listModalInputValue, setListModalInputValue] = useState('');
  const [listModalLoading, setListModalLoading] = useState(false);

  // Backup Export state
  const [backupLoading, setBackupLoading] = useState(false);



  // ---- ROLE-BASED ACCESS CONTROL --------------------------------------------
  // The sidebar & in-page action buttons are driven by the permission policy
  // attached to the logged-in user's role. What is checked for that role is
  // solely what they will see.

  const isAdminUser = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN';

  /**
   * Check a page permission for the current user.
   * - Super Admins always have full access.
   * - Roles without a policy keep full access (legacy behaviour).
   * - School/Super Admins can always reach the Permissions page (safety rail).
   */
  const can = (pageKey: string, action: PermAction = 'view'): boolean => {
    if (!permPolicyLoaded) return true; // don't flash-hide UI before policy loads
    if (user?.role === 'SUPER_ADMIN') return true;
    if (!permPolicy) return true; // no policy for this role -> full access
    if (pageKey === 'permissions' && isAdminUser) return true;
    const acts = permPolicy[pageKey];
    return Array.isArray(acts) && acts.includes(action);
  };

  /** Sidebar group (permission section) that owns a dashboard tab. */
  const navGroupForTab = (tab: string): string | null =>
    PERM_PAGES.find((page) => page.tab === tab)?.section ?? null;

  // Only one sidebar dropdown can be open at a time (accordion behavior).
  // Clicking an open group closes it; clicking a closed group closes all others and opens it.
  const toggleNavGroup = (groupKey: string) =>
    setOpenNavGroups((prev) => (prev[groupKey] ? {} : { [groupKey]: true }));

  /** The Operations / Marketing page currently open, if any. */
  const activeDepartmentResource = getResourceByTab(activeTab);

  // Load the current user's effective permission policy
  const fetchPermPolicy = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/permissions/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPermPolicy(data.policy || null);
      }
    } catch (e) {
      console.error('Failed to load permission policy:', e);
    } finally {
      setPermPolicyLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    fetchPermPolicy();
  }, [fetchPermPolicy]);

  // Reveal only the sidebar group that owns the page we just navigated to.
  useEffect(() => {
    const group = navGroupForTab(activeTab);
    // 'general' (Dashboard) is a standalone button, not a dropdown — so on a
    // fresh load every collapsible group stays closed.
    if (!group || group === 'general') return;
    setOpenNavGroups({ [group]: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Guard: if the active tab (or billing sub-tab) is not permitted for this
  // user's role, redirect to the first page they are allowed to see.
  useEffect(() => {
    if (!permPolicyLoaded || !user || !permPolicy) return;
    const pagesForTab = PERM_PAGES.filter((p) => p.tab === activeTab);
    if (pagesForTab.length === 0) return; // not a permissioned page
    const allowed = pagesForTab.filter((p) => can(p.key, 'view'));
    if (allowed.length === 0) {
      const firstAllowed = PERM_PAGES.find((p) => can(p.key, 'view'));
      if (firstAllowed) setActiveTab(firstAllowed.tab);
      return;
    }
    if (activeTab === 'billing') {
      const subOk = allowed.some((p) => p.subTab === billingSubTab);
      if (!subOk) setBillingSubTab((allowed[0].subTab as 'items' | 'categories') || 'items');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, billingSubTab, permPolicy, permPolicyLoaded, user]);
  // ---------------------------------------------------------------------------

  // Subscription data fetching & management
  const fetchSubscriptionData = useCallback(async () => {
    if (!token) return;
    setSubscriptionLoading(true);
    try {
      const res = await fetch('/api/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSubscriptionData(data);
        if (data.tenant) {
          setTenant((prev) => ({
            ...(prev || {}),
            ...data.tenant,
            plan: data.tenant.plan,
            studentLimit: data.tenant.studentLimit,
            subscription: {
              plan: data.tenant.plan,
              status: data.statusInfo?.status || 'active',
              daysRemaining: data.statusInfo?.daysRemaining ?? 14,
              isExpiringSoon: !!data.statusInfo?.isExpiringSoon,
              isExpired: !!data.statusInfo?.isExpired,
              currentPeriodEnd: data.statusInfo?.currentPeriodEnd || '',
              billingCycle: data.currentSubscription?.billingCycle || 'monthly',
            },
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching subscription data:', err);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [token]);

  const handleInitiateCheckout = async (
    planKey: string,
    cycle: 'monthly' | 'termly' | 'annual' = billingCycle,
    simulate: boolean = false,
    gatewayOverride?: 'paystack' | 'flutterwave' | 'stripe' | 'sandbox'
  ) => {
    if (!token) return;
    setCheckoutLoading(true);
    setSelectedCheckoutPlan(planKey);
    const chosenGateway = gatewayOverride || (simulate ? 'sandbox' : selectedCheckoutGateway);
    try {
      const res = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: planKey,
          billingCycle: cycle,
          gateway: chosenGateway,
          simulate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.activated) {
          setSubscriptionToast({
            message: data.message || `Successfully activated ${planKey} plan!`,
            type: 'success',
          });
          setShowUpgradeModal(false);
          await fetchSubscriptionData();
          fetchDashboardData();
        } else if (data.authorizationUrl) {
          window.location.href = data.authorizationUrl;
        }
      } else {
        alert(data.error || 'Checkout initiation failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error during checkout.');
    } finally {
      setCheckoutLoading(false);
      setSelectedCheckoutPlan(null);
    }
  };

  const handleSimulateStatus = async (action: 'set_expiring' | 'set_expired' | 'set_active') => {
    if (!token) return;
    setSimulationLoading(true);
    try {
      const res = await fetch('/api/subscriptions/simulate-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setSubscriptionToast({
          message: data.message || `Simulation updated: ${action}`,
          type: 'info',
        });
        if (action === 'set_expiring') setBannerDismissed(false);
        await fetchSubscriptionData();
        fetchDashboardData();
      } else {
        alert(data.error || 'Failed to update simulation');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing simulation');
    } finally {
      setSimulationLoading(false);
    }
  };

  // Fetch stats, students, billing and subscription data once token is loaded
  useEffect(() => {
    if (!token) return;
    fetchDashboardData();
    fetchBillingData();
    fetchSubscriptionData();
    fetchGatewaySettings();
  }, [token, fetchSubscriptionData]);

  // Online Payment Return Verification (Paystack, Flutterwave, Stripe)
  useEffect(() => {
    if (!token) return;
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentReturn = urlParams.get('payment') === 'success';
    const ref =
      urlParams.get('reference') ||
      urlParams.get('trxref') ||
      urlParams.get('session_id') ||
      urlParams.get('tx_ref') ||
      urlParams.get('transaction_id');

    if (isPaymentReturn && ref) {
      const plan = urlParams.get('plan') || 'SILVER';
      const cycle = urlParams.get('cycle') || 'monthly';
      const gateway = urlParams.get('session_id')
        ? 'stripe'
        : (urlParams.get('tx_ref') || urlParams.get('transaction_id'))
        ? 'flutterwave'
        : (urlParams.get('gateway') || 'paystack');

      const verifyReturn = async () => {
        try {
          const res = await fetch('/api/subscriptions/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              reference: ref,
              gateway,
              plan,
              billingCycle: cycle,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setSubscriptionToast({
              message: data.message || `Payment verified! School upgraded to ${plan} Plan.`,
              type: 'success',
            });
            window.history.replaceState({}, document.title, window.location.pathname + '?tab=subscription');
            await fetchSubscriptionData();
            fetchDashboardData();
          } else {
            setSubscriptionToast({
              message: data.error || 'Payment verification could not be confirmed.',
              type: 'error',
            });
          }
        } catch (e: any) {
          console.error('Payment callback verification error:', e);
        }
      };

      verifyReturn();
    }
  }, [token, fetchSubscriptionData]);

  // Global search outside-click & keyboard shortcut (Ctrl+K or /) listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchDropdownOpen(false);
      } else if (
        (e.key === 'k' && (e.metaKey || e.ctrlKey)) ||
        (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchDropdownOpen(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Profile dropdown outside-click & escape key listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && profileDropdownOpen) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileDropdownOpen]);

  // Close profile dropdown when navigating to another tab
  useEffect(() => {
    setProfileDropdownOpen(false);
  }, [activeTab]);

  // Refetch subscription when switching to subscription tab
  useEffect(() => {
    if (activeTab === 'subscription' && token) {
      fetchSubscriptionData();
    }
  }, [activeTab, token, fetchSubscriptionData]);

  const fetchBillingData = async () => {
    if (!token) return;
    setBillingLoading(true);
    try {
      const [itemsRes, catRes] = await Promise.all([
        fetch('/api/billing/items', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/billing/categories', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setBillingItems(d.items || []);
      }
      if (catRes.ok) {
        const d = await catRes.json();
        setBillingCategories(d.categories || []);
      }
    } catch (e) {
      console.error('Failed to load billing data:', e);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCreateBillingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateItemLoading(true);
    setItemError('');
    try {
      const res = await fetch('/api/billing/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newItemForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create billing item');
      setNewItemForm({ item: '', amount: '', status: 'Active', description: '' });
      setShowCreateItemModal(false);
      fetchBillingData();
    } catch (err: any) {
      setItemError(err.message);
    } finally {
      setCreateItemLoading(false);
    }
  };

  const handleDeleteBillingItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this billing item?')) return;
    try {
      const res = await fetch(`/api/billing/items?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchBillingData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBillingCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateCategoryLoading(true);
    setCategoryError('');
    try {
      const totalAmount = billingItems
        .filter((bi) => selectedItemNames.includes(bi.item))
        .reduce((sum, bi) => sum + Number(bi.amount || 0), 0);

      const res = await fetch('/api/billing/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newCategoryForm,
          academicYear: newCategoryForm.academicYear || stats?.activeYear || null,
          items: selectedItemNames,
          totalAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create billing category');
      setNewCategoryForm({ name: '', academicYear: '', term: 'Term 1', description: '' });
      setSelectedItemNames([]);
      setShowCreateCategoryModal(false);
      fetchBillingData();
    } catch (err: any) {
      setCategoryError(err.message);
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  const handleDeleteBillingCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this billing category?')) return;
    try {
      const res = await fetch(`/api/billing/categories?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchBillingData();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDashboardData = async (overrideYear?: string, overrideTerm?: string, overrideDate?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const yearToUse = overrideYear !== undefined ? overrideYear : selectedYear;
      const termToUse = overrideTerm !== undefined ? overrideTerm : selectedTerm;
      const dateToUse = overrideDate !== undefined ? overrideDate : selectedDate;

      const params = new URLSearchParams();
      if (yearToUse && yearToUse !== 'all') params.set('academicYear', yearToUse);
      if (termToUse) params.set('term', termToUse);
      if (dateToUse) params.set('date', dateToUse);

      const [statsRes, studentsRes] = await Promise.all([
        fetch(`/api/dashboard/stats?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/students', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
        if (statsData.tenant) setTenant(statsData.tenant);
        if (statsData.availableYears) setAvailableYears(statsData.availableYears);
        if (!selectedYear && statsData.activeYear) setSelectedYear(statsData.activeYear);
        if (statsData.kpis) setKpis(statsData.kpis);
        if (statsData.charts) {
          setPaymentStatusData(statsData.charts.paymentStatusByClass || []);
          setAttendanceTrendData(statsData.charts.attendanceTrend || []);
          setStudentsByClassData(statsData.charts.studentsByClass || []);
        }
        if (statsData.quickInsights) setQuickInsights(statsData.quickInsights);
      }

      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData.students || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    fetchDashboardData(year, selectedTerm, selectedDate);
  };

  const handleTermChange = (term: string) => {
    setSelectedTerm(term);
    fetchDashboardData(selectedYear, term, selectedDate);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchDashboardData(selectedYear, selectedTerm, date);
  };

  // ---- TEACHERS CRUD ----

  const fetchTeachers = async () => {
    if (!token) return;
    setTeacherLoading(true);
    try {
      const res = await fetch('/api/teachers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers || []);
        setTeachersFetched(true);
      }
    } catch (e) {
      console.error('Failed to load teachers:', e);
    } finally {
      setTeacherLoading(false);
    }
  };

  // Lazy-load teachers when the tab becomes active
  useEffect(() => {
    if (activeTab === 'teachers' && token && !teachersFetched) {
      fetchTeachers();
    }
  }, [activeTab, token]);

  // Lazy-load classes when enroll modal opens
  useEffect(() => {
    if (showEnrollModal && token && !classesFetched) {
      fetchClasses();
    }
  }, [showEnrollModal, token]);

  const openAddTeacherModal = () => {
    setEditingTeacher(null);
    setTeacherForm({ firstName: '', lastName: '', className: '', academicYear: '' });
    setTeacherFormError('');
    setShowTeacherModal(true);
  };

  const openEditTeacherModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setTeacherForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      className: teacher.className || '',
      academicYear: teacher.academicYear || '',
    });
    setTeacherFormError('');
    setShowTeacherModal(true);
  };

  const handleTeacherFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherFormLoading(true);
    setTeacherFormError('');
    try {
      const url = editingTeacher ? `/api/teachers/${editingTeacher.id}` : '/api/teachers';
      const method = editingTeacher ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(teacherForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save teacher.');
      setShowTeacherModal(false);
      setTeachersFetched(false); // force refresh
      fetchTeachers();
    } catch (err: any) {
      setTeacherFormError(err.message);
    } finally {
      setTeacherFormLoading(false);
    }
  };

  const openDeleteTeacherModal = (teacher: Teacher) => {
    setDeletingTeacher(teacher);
    setShowDeleteTeacherModal(true);
  };

  const handleDeleteTeacher = async () => {
    if (!deletingTeacher) return;
    setDeleteTeacherLoading(true);
    try {
      const res = await fetch(`/api/teachers/${deletingTeacher.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShowDeleteTeacherModal(false);
        setDeletingTeacher(null);
        setTeachersFetched(false);
        fetchTeachers();
      }
    } catch (err) {
      console.error('Failed to delete teacher:', err);
    } finally {
      setDeleteTeacherLoading(false);
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    const q = teacherSearchQuery.toLowerCase();
    if (!q) return true;
    return (
      t.teacherId.toLowerCase().includes(q) ||
      t.firstName.toLowerCase().includes(q) ||
      t.lastName.toLowerCase().includes(q) ||
      (t.className || '').toLowerCase().includes(q) ||
      (t.academicYear || '').toLowerCase().includes(q)
    );
  });

  // ---- SUBJECTS CRUD ----

  const fetchSubjects = async () => {
    if (!token) return;
    setSubjectLoading(true);
    try {
      const res = await fetch('/api/subjects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects || []);
        setSubjectsFetched(true);
      }
    } catch (e) {
      console.error('Failed to load subjects:', e);
    } finally {
      setSubjectLoading(false);
    }
  };

  // Lazy-load subjects when the tab becomes active
  useEffect(() => {
    if (activeTab === 'subjects' && token && !subjectsFetched) {
      fetchSubjects();
    }
  }, [activeTab, token]);

  const openAddSubjectModal = () => {
    setEditingSubject(null);
    setSubjectForm({ name: '', instructor: '', credits: '1', semester: '', status: 'Active' });
    setSubjectFormError('');
    setShowSubjectModal(true);
  };

  const openEditSubjectModal = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name,
      instructor: subject.instructorName || '',
      credits: String(subject.credits ?? 1),
      semester: subject.semester || '',
      status: subject.status === 'INACTIVE' ? 'Inactive' : 'Active',
    });
    setSubjectFormError('');
    setShowSubjectModal(true);
  };

  const handleSubjectFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubjectFormLoading(true);
    setSubjectFormError('');
    try {
      const url = editingSubject ? `/api/subjects/${editingSubject.id}` : '/api/subjects';
      const method = editingSubject ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subjectForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save subject.');
      setShowSubjectModal(false);
      setSubjectNotice(data.message || 'Subject saved successfully.');
      setSubjectsFetched(false); // force refresh
      fetchSubjects();
      fetchDashboardData();
    } catch (err: any) {
      setSubjectFormError(err.message);
    } finally {
      setSubjectFormLoading(false);
    }
  };

  const openDeleteSubjectModal = (subject: Subject) => {
    setDeletingSubject(subject);
    setShowDeleteSubjectModal(true);
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    setDeleteSubjectLoading(true);
    try {
      const res = await fetch(`/api/subjects/${deletingSubject.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubjectNotice(data.error || 'Failed to delete subject.');
        return;
      }
      setShowDeleteSubjectModal(false);
      setDeletingSubject(null);
      setSubjectNotice(data.message || 'Subject deleted successfully!');
      setSubjectsFetched(false);
      fetchSubjects();
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to delete subject:', err);
    } finally {
      setDeleteSubjectLoading(false);
    }
  };

  const filteredSubjects = subjects.filter((s) => {
    if (subjectStatusFilter !== 'All Statuses') {
      const wanted = subjectStatusFilter === 'Inactive' ? 'INACTIVE' : 'ACTIVE';
      if (s.status !== wanted) return false;
    }
    const q = subjectSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.instructorName || '').toLowerCase().includes(q) ||
      (s.semester || '').toLowerCase().includes(q)
    );
  });

  // ---- ACADEMIC YEARS CRUD ----

  const fetchAcademicYears = async () => {
    if (!token) return;
    setYearLoading(true);
    try {
      const res = await fetch('/api/academic-years', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAcademicYears(data.academicYears || []);
        setYearsFetched(true);
      }
    } catch (e) {
      console.error('Failed to load academic years:', e);
    } finally {
      setYearLoading(false);
    }
  };

  // Lazy-load academic years when the tab becomes active
  useEffect(() => {
    if (activeTab === 'academic-years' && token && !yearsFetched) {
      fetchAcademicYears();
    }
  }, [activeTab, token]);

  const openAddYearModal = () => {
    setEditingYear(null);
    setYearForm({
      year: '',
      status: 'Active',
      currentTerm: stats?.currentTerm || 'Term 1',
    });
    setYearFormError('');
    setShowYearModal(true);
  };

  const openEditYearModal = (year: AcademicYearRecord) => {
    setEditingYear(year);
    setYearForm({
      year: year.year,
      status: year.status === 'Inactive' ? 'Inactive' : 'Active',
      currentTerm: year.currentTerm || 'Term 1',
    });
    setYearFormError('');
    setShowYearModal(true);
  };

  const handleYearFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setYearFormLoading(true);
    setYearFormError('');
    try {
      const url = editingYear ? `/api/academic-years/${editingYear.id}` : '/api/academic-years';
      const method = editingYear ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(yearForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save academic year.');
      setShowYearModal(false);
      setYearNotice(data.message || 'Academic year saved successfully.');
      setYearsFetched(false); // force refresh
      fetchAcademicYears();
      fetchDashboardData();
    } catch (err: any) {
      setYearFormError(err.message);
    } finally {
      setYearFormLoading(false);
    }
  };

  const openDeleteYearModal = (year: AcademicYearRecord) => {
    setDeletingYear(year);
    setShowDeleteYearModal(true);
  };

  const handleDeleteYear = async () => {
    if (!deletingYear) return;
    setDeleteYearLoading(true);
    try {
      const res = await fetch(`/api/academic-years/${deletingYear.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setYearNotice(data.error || 'Failed to delete academic year.');
        return;
      }
      setShowDeleteYearModal(false);
      setDeletingYear(null);
      setYearNotice(data.message || 'Academic year deleted successfully!');
      setYearsFetched(false);
      fetchAcademicYears();
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to delete academic year:', err);
    } finally {
      setDeleteYearLoading(false);
    }
  };

  const filteredAcademicYears = academicYears.filter((y) => {
    const q = yearSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return y.year.toLowerCase().includes(q);
  });

  // ---- USERS CRUD ----

  const fetchUsers = async () => {
    if (!token) return;
    setUserLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSystemUsers(data.users || []);
        setUsersFetched(true);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && token && !usersFetched) {
      fetchUsers();
    }
  }, [activeTab, token]);

  const openAddUserModal = () => {
    setEditingUser(null);
    setUserForm({
      email: '',
      fullName: '',
      username: '',
      password: '',
      role: 'TEACHER',
      status: 'ACTIVE',
    });
    setUserFormError('');
    setShowUserModal(true);
  };

  const openEditUserModal = (u: UserRecord) => {
    setEditingUser(u);
    setUserForm({
      email: u.email,
      fullName: u.fullName,
      username: u.username || '',
      password: '',
      role: u.role,
      status: u.status,
    });
    setUserFormError('');
    setShowUserModal(true);
  };

  const resetUserFormPassword = () => {
    setUserForm((prev) => ({ ...prev, password: 'Password123' }));
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormLoading(true);
    setUserFormError('');
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save user.');
      setShowUserModal(false);
      setUserNotice(data.message || 'User saved successfully.');
      setUsersFetched(false);
      fetchUsers();
    } catch (err: any) {
      setUserFormError(err.message);
    } finally {
      setUserFormLoading(false);
    }
  };

  const openDeleteUserModal = (u: UserRecord) => {
    setDeletingUser(u);
    setShowDeleteUserModal(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteUserLoading(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUserNotice(data.error || 'Failed to delete user.');
        return;
      }
      setShowDeleteUserModal(false);
      setDeletingUser(null);
      setUserNotice(data.message || 'User deleted successfully.');
      setUsersFetched(false);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const filteredSystemUsers = systemUsers.filter((u) => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.status.toLowerCase().includes(q)
    );
  });

  // ---- PARENTS CRUD ----

  const fetchParents = async () => {
    if (!token) return;
    setParentLoading(true);
    try {
      const res = await fetch('/api/parents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setParentMappings(data.parents || []);
        setParentsFetched(true);
      }
    } catch (e) {
      console.error('Failed to load parent mappings:', e);
    } finally {
      setParentLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'parents' && token && !parentsFetched) {
      fetchParents();
    }
  }, [activeTab, token]);

  const openAddParentModal = () => {
    setEditingParent(null);
    setParentForm({
      parentName: '',
      parentUserId: '',
      studentId: students.length > 0 ? students[0].id : '',
      relationship: 'Mother',
      isPrimary: false,
      billing: 'No',
      phone: '',
      email: '',
    });
    setParentFormError('');
    setShowParentModal(true);
  };

  const openEditParentModal = (p: ParentRecord) => {
    setEditingParent(p);
    setParentForm({
      parentName: p.parentName,
      parentUserId: p.parentUserId || '',
      studentId: p.student?.id || p.studentId,
      relationship: p.relationship || 'Guardian',
      isPrimary: p.isPrimary,
      billing: p.billing || 'No',
      phone: p.phone || '',
      email: p.email || '',
    });
    setParentFormError('');
    setShowParentModal(true);
  };

  const handleParentFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentFormLoading(true);
    setParentFormError('');
    try {
      const url = editingParent ? `/api/parents/${editingParent.id}` : '/api/parents';
      const method = editingParent ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parentForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save parent mapping.');
      setShowParentModal(false);
      setParentNotice(data.message || 'Parent mapping saved successfully.');
      setParentsFetched(false);
      fetchParents();
    } catch (err: any) {
      setParentFormError(err.message);
    } finally {
      setParentFormLoading(false);
    }
  };

  const openDeleteParentModal = (p: ParentRecord) => {
    setDeletingParent(p);
    setShowDeleteParentModal(true);
  };

  const handleDeleteParent = async () => {
    if (!deletingParent) return;
    setDeleteParentLoading(true);
    try {
      const res = await fetch(`/api/parents/${deletingParent.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setParentNotice(data.error || 'Failed to delete parent mapping.');
        return;
      }
      setShowDeleteParentModal(false);
      setDeletingParent(null);
      setParentNotice(data.message || 'Parent mapping deleted successfully.');
      setParentsFetched(false);
      fetchParents();
    } catch (err) {
      console.error('Failed to delete parent mapping:', err);
    } finally {
      setDeleteParentLoading(false);
    }
  };

  const filteredParentMappings = parentMappings.filter((p) => {
    const q = parentSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const studentFullName = p.student ? `${p.student.firstName} ${p.student.lastName}` : '';
    const studentIdCode = p.student ? p.student.studentId : '';
    return (
      p.parentName.toLowerCase().includes(q) ||
      p.mappingId.toLowerCase().includes(q) ||
      (p.relationship || '').toLowerCase().includes(q) ||
      studentFullName.toLowerCase().includes(q) ||
      studentIdCode.toLowerCase().includes(q)
    );
  });

  // ---- PERMISSIONS CRUD ----

  const fetchPermissions = async () => {
    if (!token) return;
    setPermissionLoading(true);
    try {
      const res = await fetch('/api/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions || []);
        setPermissionsFetched(true);
      }
    } catch (e) {
      console.error('Failed to load permissions:', e);
    } finally {
      setPermissionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'permissions' && token && !permissionsFetched) {
      fetchPermissions();
    }
  }, [activeTab, token]);

  const openAddPermissionModal = () => {
    setEditingPermission(null);
    setPermissionForm({
      role: '',
      accessLevel: 'Full Access',
      checks: {},
    });
    setPermissionFormLegacyText('');
    setPermissionFormError('');
    setShowPermissionModal(true);
  };

  const openEditPermissionModal = (p: PermissionRecord) => {
    setEditingPermission(p);
    // Legacy records stored free text — the checkbox matrix starts empty for them.
    const parsed = parsePermPolicy(p.actions);
    setPermissionForm({
      role: p.role,
      accessLevel: p.accessLevel,
      checks: parsed || {},
    });
    setPermissionFormLegacyText(parsed ? '' : p.actions);
    setPermissionFormError('');
    setShowPermissionModal(true);
  };

  // --- Permission matrix helpers -------------------------------------------
  const setPermPageChecks = (pageKey: string, actions: PermAction[]) => {
    setPermissionForm((prev) => {
      const checks = { ...prev.checks };
      if (actions.length === 0) delete checks[pageKey];
      else checks[pageKey] = actions;
      return { ...prev, checks };
    });
  };

  const togglePermCheck = (pageKey: string, action: PermAction) => {
    setPermissionForm((prev) => {
      const current = prev.checks[pageKey] || [];
      // Toggling a non-view action automatically grants view as well
      const next: PermAction[] =
        action === 'view'
          ? current.includes('view')
            ? [] // unchecking view clears the whole row
            : ['view']
          : current.includes(action)
          ? current.filter((a) => a !== action)
          : PERM_ACTIONS.filter((a) => a === 'view' || current.includes(a) || a === action);
      const checks = { ...prev.checks };
      if (next.length === 0) delete checks[pageKey];
      else checks[pageKey] = next;
      return { ...prev, checks };
    });
  };

  const togglePermSection = (sectionKey: string) => {
    const pages = PERM_PAGES.filter((p) => p.section === sectionKey);
    const allFullyChecked = pages.every((p) => {
      const current = permissionForm.checks[p.key] || [];
      return p.actions.every((a) => current.includes(a));
    });
    if (allFullyChecked) {
      // clear the whole section
      setPermissionForm((prev) => {
        const checks = { ...prev.checks };
        pages.forEach((p) => delete checks[p.key]);
        return { ...prev, checks };
      });
    } else {
      // check every action of every page in the section
      setPermissionForm((prev) => {
        const checks = { ...prev.checks };
        pages.forEach((p) => {
          checks[p.key] = [...p.actions];
        });
        return { ...prev, checks };
      });
    }
  };

  const permSelectAll = () => {
    setPermissionForm((prev) => {
      const checks: PermPolicy = {};
      PERM_PAGES.forEach((p) => {
        checks[p.key] = [...p.actions];
      });
      return { ...prev, checks };
    });
  };

  const permClearAll = () => {
    setPermissionForm((prev) => ({ ...prev, checks: {} }));
  };

  const permCheckedPages = Object.keys(permissionForm.checks).filter(
    (k) => (permissionForm.checks[k] || []).length > 0
  );

  const handlePermissionFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPermissionFormError('');
    if (!permissionForm.role) {
      setPermissionFormError('Select the system role this permission policy applies to.');
      return;
    }
    if (permCheckedPages.length === 0) {
      setPermissionFormError('Check at least one page (with "Can see") so this role has access to something.');
      return;
    }
    setPermissionFormLoading(true);
    try {
      const url = editingPermission ? `/api/permissions/${editingPermission.id}` : '/api/permissions';
      const method = editingPermission ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: permissionForm.role,
          accessLevel: permissionForm.accessLevel,
          actions: JSON.stringify(permissionForm.checks),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save permission.');
      setShowPermissionModal(false);
      setPermissionNotice(data.message || 'Permission saved successfully.');
      setPermissionsFetched(false);
      fetchPermissions();
      // Refresh the current user's own policy — if they edited their own role,
      // their sidebar updates immediately to match what was just checked.
      fetchPermPolicy();
    } catch (err: any) {
      setPermissionFormError(err.message);
    } finally {
      setPermissionFormLoading(false);
    }
  };

  const openDeletePermissionModal = (p: PermissionRecord) => {
    setDeletingPermission(p);
    setShowDeletePermissionModal(true);
  };

  const handleDeletePermission = async () => {
    if (!deletingPermission) return;
    setDeletePermissionLoading(true);
    try {
      const res = await fetch(`/api/permissions/${deletingPermission.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPermissionNotice(data.error || 'Failed to delete permission.');
        return;
      }
      setShowDeletePermissionModal(false);
      setDeletingPermission(null);
      setPermissionNotice(data.message || 'Permission deleted successfully.');
      setPermissionsFetched(false);
      fetchPermissions();
    } catch (err) {
      console.error('Failed to delete permission:', err);
    } finally {
      setDeletePermissionLoading(false);
    }
  };

  const filteredPermissions = permissions.filter((p) => {
    const q = permissionSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.role.toLowerCase().includes(q) ||
      permRoleLabel(p.role).toLowerCase().includes(q) ||
      p.accessLevel.toLowerCase().includes(q) ||
      p.actions.toLowerCase().includes(q)
    );
  });

  // System roles that do not have a permission policy yet (they keep full access)
  const managedRoleValues = new Set(permissions.map((p) => p.role.trim().toUpperCase()));
  const unmanagedRoles = PERM_ROLES.filter((r) => !managedRoleValues.has(r.value));

  // ---- CLASSES CRUD ----

  const fetchClasses = async () => {
    if (!token) return;
    setClassLoading(true);
    try {
      const res = await fetch('/api/classes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClassesList(data.classes || []);
        setClassesFetched(true);
      }
    } catch (e) {
      console.error('Failed to load classes:', e);
    } finally {
      setClassLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'classes' && token && !classesFetched) {
      fetchClasses();
    }
  }, [activeTab, token, classesFetched]);

  const openAddClassModal = () => {
    setEditingClass(null);
    setClassForm({
      name: '',
    });
    setClassFormError('');
    setShowClassModal(true);
  };

  const openEditClassModal = (c: ClassRecord) => {
    setEditingClass(c);
    setClassForm({
      name: c.name,
    });
    setClassFormError('');
    setShowClassModal(true);
  };

  const handleClassFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassFormLoading(true);
    setClassFormError('');
    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : '/api/classes';
      const method = editingClass ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(classForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save class.');
      setShowClassModal(false);
      setClassNotice(data.message || 'Class saved successfully.');
      setClassesFetched(false);
      fetchClasses();
    } catch (err: any) {
      setClassFormError(err.message);
    } finally {
      setClassFormLoading(false);
    }
  };

  const openDeleteClassModal = (c: ClassRecord) => {
    if ((c._count?.students ?? 0) > 0) {
      setClassNotice(`Cannot delete "${c.name}" because ${c._count?.students} student(s) are currently assigned to this class. Move or remove students before deleting this class.`);
      return;
    }
    setDeletingClass(c);
    setShowDeleteClassModal(true);
  };

  const handleDeleteClass = async () => {
    if (!deletingClass) return;
    setDeleteClassLoading(true);
    try {
      const res = await fetch(`/api/classes/${deletingClass.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setClassNotice(data.error || 'Failed to delete class.');
        return;
      }
      setShowDeleteClassModal(false);
      setDeletingClass(null);
      setClassNotice(data.message || 'Class deleted successfully.');
      setClassesFetched(false);
      fetchClasses();
    } catch (err) {
      console.error('Failed to delete class:', err);
    } finally {
      setDeleteClassLoading(false);
    }
  };

  const filteredClasses = classesList.filter((c) => {
    const q = classSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.classTeacher?.fullName || '').toLowerCase().includes(q)
    );
  });

  // ---- ATTENDANCE CRUD ----

  const fetchAttendance = async () => {
    if (!token) return;
    setAttendanceLoading(true);
    try {
      const params = new URLSearchParams();
      if (attendanceDateFilter) params.append('date', attendanceDateFilter);
      if (attendanceClassFilter) params.append('classId', attendanceClassFilter);
      if (attendanceStatusFilter) params.append('status', attendanceStatusFilter);
      if (attendanceTermFilter) params.append('term', attendanceTermFilter);
      if (attendanceSearchQuery.trim()) params.append('q', attendanceSearchQuery.trim());

      const url = `/api/attendance${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAttendanceList(data.attendance || []);
        setAttendanceFetched(true);
      }
    } catch (e) {
      console.error('Failed to load attendance:', e);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance' && token) {
      fetchAttendance();
    }
  }, [
    activeTab,
    token,
    attendanceDateFilter,
    attendanceClassFilter,
    attendanceStatusFilter,
    attendanceTermFilter,
  ]);

  const loadClassRoster = async (classId: string) => {
    setMarkAttendanceClassId(classId);
    if (!classId) {
      setRosterStudents([]);
      setRosterStatusMap({});
      return;
    }
    setRosterLoading(true);
    try {
      const res = await fetch(`/api/students?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const studs: Student[] = data.students || [];
        setRosterStudents(studs);
        const initialMap: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
        studs.forEach((s) => {
          initialMap[s.id] = 'PRESENT';
        });
        setRosterStatusMap(initialMap);
      }
    } catch (err) {
      console.error('Failed to load students for class:', err);
    } finally {
      setRosterLoading(false);
    }
  };

  const openMarkAttendanceModal = () => {
    const activeYear = academicYears.find((y) => y.status === 'ACTIVE') || academicYears[0];
    const initialYearId = activeYear ? activeYear.id : '';
    const initialTerm = activeYear ? activeYear.currentTerm || 'Term 1' : 'Term 1';

    setMarkAttendanceDate(new Date().toISOString().split('T')[0]);
    setMarkAttendanceYearId(initialYearId);
    setMarkAttendanceTerm(initialTerm);
    setMarkAttendanceError('');
    setRosterStudents([]);
    setRosterStatusMap({});
    setRosterNotesMap({});

    if (classesList.length > 0) {
      loadClassRoster(classesList[0].id);
    } else {
      setMarkAttendanceClassId('');
    }

    setShowMarkAttendanceModal(true);
  };

  const handleMarkAllStatus = (status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
    const updated: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
    rosterStudents.forEach((s) => {
      updated[s.id] = status;
    });
    setRosterStatusMap(updated);
  };

  const handleBulkAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markAttendanceClassId || !markAttendanceYearId || !markAttendanceTerm || !markAttendanceDate) {
      setMarkAttendanceError('Please fill in Date, Class, Academic Year, and Term.');
      return;
    }
    if (rosterStudents.length === 0) {
      setMarkAttendanceError('No students found in the selected class.');
      return;
    }

    setMarkAttendanceSubmitting(true);
    setMarkAttendanceError('');
    try {
      const records = rosterStudents.map((s) => ({
        studentId: s.id,
        status: rosterStatusMap[s.id] || 'PRESENT',
        notes: rosterNotesMap[s.id] || '',
      }));

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bulk: true,
          classId: markAttendanceClassId,
          academicYearId: markAttendanceYearId,
          term: markAttendanceTerm,
          date: markAttendanceDate,
          records,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit attendance.');

      setShowMarkAttendanceModal(false);
      setAttendanceNotice(data.message || 'Attendance records saved successfully.');
      fetchAttendance();
    } catch (err: any) {
      setMarkAttendanceError(err.message);
    } finally {
      setMarkAttendanceSubmitting(false);
    }
  };

  const openEditAttendanceModal = (record: AttendanceRecord) => {
    setEditingAttendance(record);
    setEditAttendanceStatus(record.status);
    setEditAttendanceNotes(record.notes || '');
    setEditAttendanceError('');
    setShowEditAttendanceModal(true);
  };

  const handleEditAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance) return;

    setEditAttendanceLoading(true);
    setEditAttendanceError('');
    try {
      const res = await fetch(`/api/attendance/${editingAttendance.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: editAttendanceStatus,
          notes: editAttendanceNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update attendance record.');

      setShowEditAttendanceModal(false);
      setEditingAttendance(null);
      setAttendanceNotice(data.message || 'Attendance record updated successfully.');
      fetchAttendance();
    } catch (err: any) {
      setEditAttendanceError(err.message);
    } finally {
      setEditAttendanceLoading(false);
    }
  };

  const openDeleteAttendanceModal = (record: AttendanceRecord) => {
    setDeletingAttendance(record);
    setShowDeleteAttendanceModal(true);
  };

  const handleDeleteAttendance = async () => {
    if (!deletingAttendance) return;
    setDeleteAttendanceLoading(true);
    try {
      const res = await fetch(`/api/attendance/${deletingAttendance.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttendanceNotice(data.error || 'Failed to delete attendance record.');
        return;
      }
      setShowDeleteAttendanceModal(false);
      setDeletingAttendance(null);
      setAttendanceNotice(data.message || 'Attendance record deleted successfully.');
      fetchAttendance();
    } catch (err) {
      console.error('Failed to delete attendance:', err);
    } finally {
      setDeleteAttendanceLoading(false);
    }
  };

  const filteredAttendance = attendanceList.filter((a) => {
    const q = attendanceSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const studentName = a.student ? `${a.student.firstName} ${a.student.lastName}` : '';
    const studentIdCode = a.student ? a.student.studentId : '';
    const className = a.class ? a.class.name : '';
    const notes = a.notes || '';
    return (
      studentName.toLowerCase().includes(q) ||
      studentIdCode.toLowerCase().includes(q) ||
      className.toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q) ||
      notes.toLowerCase().includes(q)
    );
  });

  // Performance Handlers
  const fetchPerformance = async () => {
    if (!token) return;
    setPerformanceLoading(true);
    try {
      const params = new URLSearchParams();
      if (performanceClassFilter) params.append('class', performanceClassFilter);
      if (performanceYearFilter) params.append('academicYear', performanceYearFilter);
      if (performanceTermFilter) params.append('term', performanceTermFilter);
      if (performanceSubjectFilter) params.append('course', performanceSubjectFilter);

      const res = await fetch(`/api/performance?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPerformanceList(data.records || []);
        setPerformanceFetched(true);
      }
    } catch (e) {
      console.error('Failed to load performance:', e);
    } finally {
      setPerformanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'performance' && token) {
      fetchPerformance();
      if (!classesFetched) fetchClasses();
      if (!yearsFetched) fetchAcademicYears();
      if (!subjectsFetched) fetchSubjects();
    }
  }, [
    activeTab,
    token,
    performanceClassFilter,
    performanceYearFilter,
    performanceTermFilter,
    performanceSubjectFilter,
    classesFetched,
    yearsFetched,
    subjectsFetched,
  ]);

  const handleClassSelectForPerformance = async (classId: string) => {
    setPerfSelectedClassId(classId);
    const cls = classesList.find((c) => c.id === classId);
    const className = cls ? cls.name : '';
    setPerformanceForm((prev) => ({
      ...prev,
      studentClass: className,
      studentId: '',
    }));

    if (!classId) {
      setPerfClassStudents([]);
      return;
    }

    setPerfClassStudentsLoading(true);
    try {
      const res = await fetch(`/api/students?classId=${encodeURIComponent(classId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPerfClassStudents(data.students || []);
      }
    } catch (err) {
      console.error('Failed to load students for class:', err);
    } finally {
      setPerfClassStudentsLoading(false);
    }
  };

  const computeScorePreview = (classScoreVal: string, examScoreVal: string) => {
    const cScore = parseFloat(classScoreVal) || 0;
    const e100 = parseFloat(examScoreVal) || 0;
    const e50 = Math.round(e100 * 0.5 * 10) / 10;
    const tot = Math.round((cScore + e50) * 10) / 10;

    let grade = '9';
    let remarks = 'Lowest';

    if (tot >= 80) {
      grade = '1';
      remarks = 'Highest';
    } else if (tot >= 70) {
      grade = '2';
      remarks = 'Higher';
    } else if (tot >= 65) {
      grade = '3';
      remarks = 'High';
    } else if (tot >= 60) {
      grade = '4';
      remarks = 'High Average';
    } else if (tot >= 55) {
      grade = '5';
      remarks = 'Average';
    } else if (tot >= 50) {
      grade = '6';
      remarks = 'Low Average';
    } else if (tot >= 45) {
      grade = '7';
      remarks = 'Low';
    } else if (tot >= 40) {
      grade = '8';
      remarks = 'Lower';
    } else {
      grade = '9';
      remarks = 'Lowest';
    }

    return {
      classScore: cScore,
      examScore50: e50,
      total: tot,
      grade,
      remarks,
    };
  };

  const openAddPerformanceModal = () => {
    const activeYear = academicYears.find((y) => y.status === 'ACTIVE' || y.status === 'Active')?.year || academicYears[0]?.year || '';
    setPerformanceForm({
      studentId: '',
      studentClass: '',
      course: subjects[0]?.name || 'Mathematics',
      term: 'Term 1',
      academicYear: activeYear,
      classScore: '',
      examScore100: '',
    });
    setPerfSelectedClassId('');
    setPerfClassStudents([]);
    setPerformanceFormError('');
    setShowAddPerformanceModal(true);
  };

  const handlePerformanceFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!performanceForm.studentId) {
      setPerformanceFormError('Please select a student.');
      return;
    }
    if (!performanceForm.course) {
      setPerformanceFormError('Please select or specify a course/subject.');
      return;
    }
    if (!performanceForm.academicYear) {
      setPerformanceFormError('Please select an academic year.');
      return;
    }

    const cScore = parseFloat(performanceForm.classScore);
    if (isNaN(cScore) || cScore < 0 || cScore > 50) {
      setPerformanceFormError('Class continuous assessment score must be between 0 and 50.');
      return;
    }
    const e100 = parseFloat(performanceForm.examScore100);
    if (isNaN(e100) || e100 < 0 || e100 > 100) {
      setPerformanceFormError('Exam score (100%) must be between 0 and 100.');
      return;
    }

    setPerformanceFormLoading(true);
    setPerformanceFormError('');

    try {
      const res = await fetch('/api/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: performanceForm.studentId,
          studentClass: performanceForm.studentClass,
          course: performanceForm.course,
          term: performanceForm.term,
          academicYear: performanceForm.academicYear,
          classScore: cScore,
          examScore100: e100,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save performance record.');
      }

      setShowAddPerformanceModal(false);
      setPerformanceNotice(data.message || 'Performance record added successfully.');
      fetchPerformance();
    } catch (err: any) {
      setPerformanceFormError(err.message);
    } finally {
      setPerformanceFormLoading(false);
    }
  };

  const openEditPerformanceModal = (record: PerformanceRecord) => {
    setEditingPerformance(record);
    setEditPerformanceForm({
      course: record.course || '',
      term: record.term || 'Term 1',
      academicYear: record.academicYear || '',
      studentClass: record.studentClass || '',
      classScore: String(record.classScore ?? ''),
      examScore100: String(record.examScore100 ?? ''),
    });
    setEditPerformanceError('');
    setShowEditPerformanceModal(true);
  };

  const handleEditPerformanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerformance) return;

    const cScore = parseFloat(editPerformanceForm.classScore);
    if (isNaN(cScore) || cScore < 0 || cScore > 50) {
      setEditPerformanceError('Class score must be between 0 and 50.');
      return;
    }
    const e100 = parseFloat(editPerformanceForm.examScore100);
    if (isNaN(e100) || e100 < 0 || e100 > 100) {
      setEditPerformanceError('Exam score must be between 0 and 100.');
      return;
    }

    setEditPerformanceLoading(true);
    setEditPerformanceError('');

    try {
      const res = await fetch(`/api/performance/${editingPerformance.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          course: editPerformanceForm.course,
          term: editPerformanceForm.term,
          academicYear: editPerformanceForm.academicYear,
          studentClass: editPerformanceForm.studentClass,
          classScore: cScore,
          examScore100: e100,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update performance record.');

      setShowEditPerformanceModal(false);
      setEditingPerformance(null);
      setPerformanceNotice(data.message || 'Performance record updated successfully.');
      fetchPerformance();
    } catch (err: any) {
      setEditPerformanceError(err.message);
    } finally {
      setEditPerformanceLoading(false);
    }
  };

  const openDeletePerformanceModal = (record: PerformanceRecord) => {
    setDeletingPerformance(record);
    setShowDeletePerformanceModal(true);
  };

  const handleDeletePerformance = async () => {
    if (!deletingPerformance) return;
    setDeletePerformanceLoading(true);
    try {
      const res = await fetch(`/api/performance/${deletingPerformance.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPerformanceNotice(data.error || 'Failed to delete performance record.');
        return;
      }
      setShowDeletePerformanceModal(false);
      setDeletingPerformance(null);
      setPerformanceNotice(data.message || 'Performance record deleted successfully.');
      fetchPerformance();
    } catch (err) {
      console.error('Failed to delete performance:', err);
    } finally {
      setDeletePerformanceLoading(false);
    }
  };

  // ─── BULK ADVANCED ENTRY ───────────────────────────────────────────────────
  const loadBulkGrid = async () => {
    if (!bulkYear || !bulkClassId || !bulkTerm || !bulkCourse) return;
    setBulkGridLoading(true);
    setBulkNotice('');
    try {
      // Fetch students in class
      const res = await fetch(`/api/students?classId=${bulkClassId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setBulkNotice(data.error || 'Failed to load students.'); return; }
      const studs = (data.students || []) as { id: string; studentId: string; firstName: string; lastName: string }[];
      // Fetch existing performance for this combination
      const selClass = classesList.find((c) => c.id === bulkClassId);
      const className = selClass?.name || '';
      const perfRes = await fetch(`/api/performance?class=${encodeURIComponent(className)}&academicYear=${encodeURIComponent(bulkYear)}&term=${encodeURIComponent(bulkTerm)}&course=${encodeURIComponent(bulkCourse)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const perfData = await perfRes.json();
      const existingMap = new Map<string, { classScore: string; examScore100: string }>();
      ((perfData.data || []) as { studentId: string; classScore: unknown; examScore100: unknown }[]).forEach((p) => {
        existingMap.set(p.studentId, { classScore: String(p.classScore ?? ''), examScore100: String(p.examScore100 ?? '') });
      });
      setBulkStudents(studs.map((s) => {
        const ex = existingMap.get(s.id);
        const cs = ex?.classScore ?? '';
        const ex100 = ex?.examScore100 ?? '';
        const ex50 = ex100 !== '' ? (Number(ex100) * 0.5).toFixed(1) : '';
        const tot = cs !== '' && ex50 !== '' ? (Number(cs) + Number(ex50)).toFixed(1) : '';
        return { id: s.id, studentId: s.studentId, firstName: s.firstName, lastName: s.lastName, classScore: cs, examScore100: ex100, examScore50: ex50, total: tot };
      }));
    } catch (err) {
      console.error('loadBulkGrid error:', err);
      setBulkNotice('Failed to load student grid.');
    } finally {
      setBulkGridLoading(false);
    }
  };

  const updateBulkRow = (idx: number, field: 'classScore' | 'examScore100', value: string) => {
    setBulkStudents((prev) => {
      const next = [...prev];
      const row = { ...next[idx] };
      if (field === 'classScore') row.classScore = value;
      if (field === 'examScore100') row.examScore100 = value;
      const cs = Number(row.classScore) || 0;
      const ex100 = Number(row.examScore100) || 0;
      row.examScore50 = (ex100 * 0.5).toFixed(1);
      row.total = (cs + Number(row.examScore50)).toFixed(1);
      next[idx] = row;
      return next;
    });
  };

  const saveBulkPerformance = async () => {
    if (!bulkYear || !bulkClassId || !bulkTerm || !bulkCourse) return;
    setBulkSaveLoading(true);
    setBulkNotice('');
    const selClass = classesList.find((c) => c.id === bulkClassId);
    const className = selClass?.name || '';
    let saved = 0, failed = 0;
    for (const row of bulkStudents) {
      if (row.classScore === '' || row.examScore100 === '') continue;
      try {
        const res = await fetch('/api/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ studentId: row.id, studentClass: className, academicYear: bulkYear, term: bulkTerm, course: bulkCourse, classScore: Number(row.classScore), examScore100: Number(row.examScore100) }),
        });
        if (res.ok) saved++; else failed++;
      } catch { failed++; }
    }
    setBulkNotice(failed === 0 ? `✅ Saved ${saved} records successfully.` : `✅ Saved ${saved}, ⚠️ ${failed} failed.`);
    setBulkSaveLoading(false);
    fetchPerformance();
  };

  // ─── CSV IMPORT ─────────────────────────────────────────────────────────────
  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const rows: CsvPerfRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (cols.length < 8) continue;
        rows.push({ studentId: cols[0], studentName: cols[1], studentClass: cols[2], term: cols[3], academicYear: cols[4], course: cols[5], classScore: cols[6], examScore100: cols[7] });
      }
      setCsvPerfRows(rows);
      setCsvImportNotice(`${rows.length} rows parsed from CSV. Review preview, then click Import.`);
    };
    reader.readAsText(file);
  };

  const importCsvPerformance = async () => {
    setCsvImportLoading(true);
    setCsvImportNotice('Importing…');
    let saved = 0, failed = 0;
    for (const row of csvPerfRows) {
      try {
        const res = await fetch('/api/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ studentName: row.studentName, studentClass: row.studentClass, academicYear: row.academicYear, term: row.term, course: row.course, classScore: Number(row.classScore), examScore100: Number(row.examScore100) }),
        });
        if (res.ok) saved++; else failed++;
      } catch { failed++; }
    }
    setCsvImportNotice(failed === 0 ? `✅ Imported ${saved} records successfully.` : `✅ Imported ${saved}, ⚠️ ${failed} failed.`);
    setCsvImportLoading(false);
    fetchPerformance();
  };

  const downloadCsvTemplate = () => {
    const header = 'Student ID,Student Name,Class,Term,Academic Year,Course,Class Score,Exam Score (100)';
    const blob = new Blob([header], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'performance_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsvSample = () => {
    const content = 'Student ID,Student Name,Class,Term,Academic Year,Course,Class Score,Exam Score (100)\nSTU-001,John Doe,Grade 5,Term 1,2024/2025,Mathematics,42,78\nSTU-002,Jane Smith,Grade 5,Term 1,2024/2025,Science,38,65';
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'performance_sample.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── TERMINAL REPORT ────────────────────────────────────────────────────────
  const loadTermReportStudents = async () => {
    if (!termReportClass) return;
    setTermReportLoading(true);
    try {
      const res = await fetch(`/api/students?classId=${termReportClass}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const studs = (data.students || []) as { id: string; studentId: string; firstName: string; lastName: string }[];
      setTermReportStudents(studs.map((s) => ({ id: s.id, name: s.firstName + ' ' + s.lastName, studentId: s.studentId, selected: true })));
    } catch (err) {
      console.error('loadTermReportStudents error:', err);
    } finally {
      setTermReportLoading(false);
    }
  };

  const generateTerminalReport = async (studentId: string) => {
    if (!termReportYear || !termReportTerm || !termReportClass) return;
    const selClass = classesList.find((c) => c.id === termReportClass);
    const className = selClass?.name || '';
    const student = termReportStudents.find((s) => s.id === studentId);
    if (!student) return;
    try {
      const res = await fetch(`/api/performance?studentId=${studentId}&academicYear=${encodeURIComponent(termReportYear)}&term=${encodeURIComponent(termReportTerm)}&class=${encodeURIComponent(className)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const records = (data.data || []) as PerformanceRecord[];
      const html = buildReportCardHtml({ student: { name: student.name, studentId: student.studentId }, records, className, term: termReportTerm, academicYear: termReportYear, schoolName: tenant?.name || 'School', schoolAddress: tenant?.address || '' });
      const win = window.open('', '_blank');
      if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 800); }
    } catch (err) {
      console.error('generateTerminalReport error:', err);
    }
  };

  const buildReportCardHtml = ({ student, records, className, term, academicYear, schoolName, schoolAddress }: { student: { name: string; studentId: string }; records: PerformanceRecord[]; className: string; term: string; academicYear: string; schoolName: string; schoolAddress: string }) => {
    const rows = records.map((r) => {
      const total = Number(r.total) || 0;
      const grade = r.grade || '';
      const remarks = r.remarks || '';
      return `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 14px;">${r.course}</td><td style="padding:10px 14px;text-align:center;">${Number(r.classScore).toFixed(1)}</td><td style="padding:10px 14px;text-align:center;">${Number(r.examScore100).toFixed(1)}</td><td style="padding:10px 14px;text-align:center;">${Number(r.examScore60 ?? (Number(r.examScore100) * 0.5)).toFixed(1)}</td><td style="padding:10px 14px;text-align:center;font-weight:bold;">${total.toFixed(1)}%</td><td style="padding:10px 14px;text-align:center;font-weight:bold;">${grade}</td><td style="padding:10px 14px;">${remarks}</td></tr>`;
    }).join('');
    const avg = records.length > 0 ? (records.reduce((s, r) => s + (Number(r.total) || 0), 0) / records.length).toFixed(1) : 'N/A';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Terminal Report Card — ${student.name}</title><style>*{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;box-sizing:border-box;}body{padding:32px;background:#fff;color:#0f172a;}h1{font-size:22px;text-align:center;margin-bottom:4px;}.subtitle{text-align:center;color:#64748b;font-size:13px;margin-bottom:20px;}.meta{display:flex;justify-content:space-between;margin-bottom:16px;font-size:13px;}.meta span{color:#334155;}table{width:100%;border-collapse:collapse;font-size:13px;}thead{background:#f8fafc;}th{padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;}tfoot{background:#f1f5f9;font-weight:bold;}@media print{body{padding:16px;}}</style></head><body><h1>${schoolName}</h1><p class="subtitle">${schoolAddress}</p><hr style="margin:12px 0;border-color:#e2e8f0;"><h2 style="text-align:center;font-size:15px;margin-bottom:16px;">TERMINAL REPORT CARD — ${term} · ${academicYear}</h2><div class="meta"><span><strong>Student:</strong> ${student.name}</span><span><strong>ID:</strong> ${student.studentId}</span><span><strong>Class:</strong> ${className}</span></div><table><thead><tr><th>Subject</th><th style="text-align:center;">Class (50%)</th><th style="text-align:center;">Exam (100%)</th><th style="text-align:center;">Exam (50%)</th><th style="text-align:center;">Total</th><th style="text-align:center;">Grade</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="4" style="padding:10px 14px;">Overall Average</td><td style="padding:10px 14px;text-align:center;">${avg}%</td><td colspan="2"></td></tr></tfoot></table></body></html>`;
  };

  const filteredPerformance = performanceList.filter((p) => {
    const q = performanceSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const studentName = p.student ? `${p.student.firstName} ${p.student.lastName}` : (p.studentName || '');
    const studentIdCode = p.student ? p.student.studentId : '';
    const perfId = p.performanceId || '';
    const course = p.course || '';
    const studentClass = p.studentClass || '';
    const grade = p.grade || '';
    const remarks = p.remarks || '';
    return (
      studentName.toLowerCase().includes(q) ||
      studentIdCode.toLowerCase().includes(q) ||
      perfId.toLowerCase().includes(q) ||
      course.toLowerCase().includes(q) ||
      studentClass.toLowerCase().includes(q) ||
      grade.toLowerCase().includes(q) ||
      remarks.toLowerCase().includes(q)
    );
  });

  // Invoices Handlers
  const fetchInvoices = async () => {
    if (!token) return;
    setInvoicesLoading(true);
    try {
      const params = new URLSearchParams();
      if (invoiceYearFilter) params.append('academicYearId', invoiceYearFilter);
      if (invoiceTermFilter) params.append('term', invoiceTermFilter);
      if (invoiceStatusFilter) params.append('status', invoiceStatusFilter);
      if (invoiceClassFilter) params.append('classId', invoiceClassFilter);

      const res = await fetch(`/api/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvoicesList(data.invoices || []);
        setInvoicesFetched(true);
      }
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'invoices' && token) {
      fetchInvoices();
      if (!classesFetched) fetchClasses();
      if (!yearsFetched) fetchAcademicYears();
      if (!billingCategories.length) fetchBillingData();
    }
  }, [
    activeTab,
    token,
    invoiceYearFilter,
    invoiceTermFilter,
    invoiceStatusFilter,
    invoiceClassFilter,
    classesFetched,
    yearsFetched,
  ]);

  const handleClassSelectForInvoice = async (classId: string) => {
    setInvSelectedClassId(classId);
    setInvoiceForm((prev) => ({
      ...prev,
      studentId: '',
    }));

    if (!classId) {
      setInvClassStudents([]);
      return;
    }

    setInvClassStudentsLoading(true);
    try {
      const res = await fetch(`/api/students?classId=${encodeURIComponent(classId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvClassStudents(data.students || []);
      }
    } catch (err) {
      console.error('Failed to load students for invoice class:', err);
    } finally {
      setInvClassStudentsLoading(false);
    }
  };

  const openAddInvoiceModal = () => {
    const activeYearObj = academicYears.find((y) => y.status === 'ACTIVE' || y.status === 'Active') || academicYears[0];
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setInvoiceForm({
      studentId: '',
      academicYearId: activeYearObj?.id || '',
      term: activeYearObj?.currentTerm || 'Term 1',
      category: 'Tuition',
      items: '',
      totalAmount: '',
      paidAmount: '0',
      issueDate: today,
      dueDate: thirtyDaysLater,
    });
    setInvSelectedClassId('');
    setInvClassStudents([]);
    setInvoiceFormError('');
    setShowAddInvoiceModal(true);
  };

  const handleInvoiceFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.studentId) {
      setInvoiceFormError('Please select a student.');
      return;
    }
    if (!invoiceForm.academicYearId) {
      setInvoiceFormError('Please select an academic year.');
      return;
    }
    const tot = parseFloat(invoiceForm.totalAmount);
    if (isNaN(tot) || tot <= 0) {
      setInvoiceFormError('Total amount must be greater than 0.');
      return;
    }
    const paid = parseFloat(invoiceForm.paidAmount || '0') || 0;
    if (paid < 0) {
      setInvoiceFormError('Paid amount cannot be negative.');
      return;
    }

    setInvoiceFormLoading(true);
    setInvoiceFormError('');

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: invoiceForm.studentId,
          academicYearId: invoiceForm.academicYearId,
          term: invoiceForm.term,
          category: invoiceForm.category,
          items: invoiceForm.items,
          totalAmount: tot,
          paidAmount: paid,
          issueDate: invoiceForm.issueDate,
          dueDate: invoiceForm.dueDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invoice.');
      }

      setShowAddInvoiceModal(false);
      setInvoiceNotice(data.message || 'Invoice created successfully.');
      fetchInvoices();
    } catch (err: any) {
      setInvoiceFormError(err.message);
    } finally {
      setInvoiceFormLoading(false);
    }
  };

  const openBulkInvoiceModal = () => {
    const activeYearObj = academicYears.find((y) => y.status === 'ACTIVE' || y.status === 'Active') || academicYears[0];
    const defaultCat = billingCategories[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setBulkInvForm({
      classId: classesList[0]?.id || '',
      academicYearId: activeYearObj?.id || '',
      term: activeYearObj?.currentTerm || 'Term 1',
      category: defaultCat ? defaultCat.name : 'Tuition',
      items: defaultCat?.items || '',
      totalAmount: defaultCat ? String(defaultCat.totalAmount) : '',
      dueDate: thirtyDaysLater,
    });
    setBulkInvError('');
    setShowBulkInvoiceModal(true);
  };

  const handleBulkInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInvForm.classId) {
      setBulkInvError('Please select a target class.');
      return;
    }
    if (!bulkInvForm.academicYearId) {
      setBulkInvError('Please select an academic year.');
      return;
    }
    const tot = parseFloat(bulkInvForm.totalAmount);
    if (isNaN(tot) || tot <= 0) {
      setBulkInvError('Total invoice amount must be greater than 0.');
      return;
    }

    setBulkInvLoading(true);
    setBulkInvError('');

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bulk: true,
          classId: bulkInvForm.classId,
          academicYearId: bulkInvForm.academicYearId,
          term: bulkInvForm.term,
          category: bulkInvForm.category,
          items: bulkInvForm.items,
          totalAmount: tot,
          dueDate: bulkInvForm.dueDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate class invoices.');
      }

      setShowBulkInvoiceModal(false);
      setInvoiceNotice(data.message || `Generated ${data.count || 0} invoices.`);
      fetchInvoices();
    } catch (err: any) {
      setBulkInvError(err.message);
    } finally {
      setBulkInvLoading(false);
    }
  };

  const openEditInvoiceModal = (inv: InvoiceRecord) => {
    setEditingInvoice(inv);
    setEditInvoiceForm({
      academicYearId: inv.academicYearId || '',
      term: inv.term || 'Term 1',
      category: inv.category || 'Tuition',
      items: inv.items || '',
      totalAmount: String(inv.totalAmount),
      paidAmount: String(inv.paidAmount),
      issueDate: inv.issueDate || '',
      dueDate: inv.dueDate || '',
      status: inv.status || 'UNPAID',
    });
    setEditInvoiceError('');
    setShowEditInvoiceModal(true);
  };

  const handleEditInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    const tot = parseFloat(editInvoiceForm.totalAmount);
    if (isNaN(tot) || tot <= 0) {
      setEditInvoiceError('Total amount must be greater than 0.');
      return;
    }
    const paid = parseFloat(editInvoiceForm.paidAmount || '0') || 0;
    if (paid < 0) {
      setEditInvoiceError('Paid amount cannot be negative.');
      return;
    }

    setEditInvoiceLoading(true);
    setEditInvoiceError('');

    try {
      const res = await fetch(`/api/invoices/${editingInvoice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          academicYearId: editInvoiceForm.academicYearId,
          term: editInvoiceForm.term,
          category: editInvoiceForm.category,
          items: editInvoiceForm.items,
          totalAmount: tot,
          paidAmount: paid,
          issueDate: editInvoiceForm.issueDate,
          dueDate: editInvoiceForm.dueDate || null,
          status: editInvoiceForm.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update invoice.');

      setShowEditInvoiceModal(false);
      setEditingInvoice(null);
      setInvoiceNotice(data.message || 'Invoice updated successfully.');
      fetchInvoices();
    } catch (err: any) {
      setEditInvoiceError(err.message);
    } finally {
      setEditInvoiceLoading(false);
    }
  };

  const openDeleteInvoiceModal = (inv: InvoiceRecord) => {
    setDeletingInvoice(inv);
    setShowDeleteInvoiceModal(true);
  };

  const handleDeleteInvoice = async () => {
    if (!deletingInvoice) return;
    setDeleteInvoiceLoading(true);
    try {
      const res = await fetch(`/api/invoices/${deletingInvoice.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvoiceNotice(data.error || 'Failed to delete invoice.');
        return;
      }
      setShowDeleteInvoiceModal(false);
      setDeletingInvoice(null);
      setInvoiceNotice(data.message || 'Invoice deleted successfully.');
      fetchInvoices();
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    } finally {
      setDeleteInvoiceLoading(false);
    }
  };

  const filteredInvoices = invoicesList.filter((inv) => {
    const q = invoiceSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const invNum = inv.invoiceNumber.toLowerCase();
    const studentName = inv.student ? `${inv.student.firstName} ${inv.student.lastName}`.toLowerCase() : '';
    const studentIdCode = inv.student?.studentId?.toLowerCase() || '';
    const className = inv.student?.class?.name?.toLowerCase() || '';
    const category = (inv.category || '').toLowerCase();
    const items = (inv.items || '').toLowerCase();
    const status = inv.status.toLowerCase();

    return (
      invNum.includes(q) ||
      studentName.includes(q) ||
      studentIdCode.includes(q) ||
      className.includes(q) ||
      category.includes(q) ||
      items.includes(q) ||
      status.includes(q)
    );
  });

  // Payments Handlers
  const fetchPayments = async () => {
    if (!token) return;
    setPaymentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (paymentsYearFilter) params.append('academicYearId', paymentsYearFilter);
      if (paymentsTermFilter) params.append('term', paymentsTermFilter);
      if (paymentsClassFilter) params.append('classId', paymentsClassFilter);
      if (paymentsMethodFilter) params.append('paymentMethod', paymentsMethodFilter);
      if (paymentsStatusFilter) params.append('status', paymentsStatusFilter);
      if (paymentsDateFromFilter) params.append('dateFrom', paymentsDateFromFilter);
      if (paymentsDateToFilter) params.append('dateTo', paymentsDateToFilter);

      const res = await fetch(`/api/payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setPaymentsFetched(true);
      }
    } catch (e) {
      console.error('Failed to load payments:', e);
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'payments' && token) {
      fetchPayments();
      if (!classesFetched) fetchClasses();
      if (!yearsFetched) fetchAcademicYears();
      if (!invoicesFetched) fetchInvoices();
    }
  }, [
    activeTab,
    token,
    paymentsYearFilter,
    paymentsTermFilter,
    paymentsClassFilter,
    paymentsMethodFilter,
    paymentsStatusFilter,
    paymentsDateFromFilter,
    paymentsDateToFilter,
    classesFetched,
    yearsFetched,
  ]);

  const handleClassSelectForPayment = async (classId: string) => {
    setPaySelectedClassId(classId);
    setPaymentForm((prev) => ({
      ...prev,
      studentId: '',
      invoiceId: '',
    }));
    setPayStudentInvoices([]);

    if (!classId) {
      setPayClassStudents([]);
      return;
    }

    setPayClassStudentsLoading(true);
    try {
      const res = await fetch(`/api/students?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayClassStudents(data.students || []);
      }
    } catch (err) {
      console.error('Failed to fetch class students:', err);
    } finally {
      setPayClassStudentsLoading(false);
    }
  };

  const handleStudentSelectForPayment = async (studentId: string) => {
    setPaymentForm((prev) => ({
      ...prev,
      studentId,
      invoiceId: '',
    }));

    if (!studentId) {
      setPayStudentInvoices([]);
      return;
    }

    setPayStudentInvoicesLoading(true);
    try {
      const res = await fetch(`/api/invoices?studentId=${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const invs: InvoiceRecord[] = data.invoices || [];
        setPayStudentInvoices(invs);

        // Auto-select open invoice if any
        const openInv = invs.find((i) => i.status !== 'PAID') || invs[0];
        if (openInv) {
          setPaymentForm((prev) => ({
            ...prev,
            invoiceId: openInv.id,
            academicYearId: openInv.academicYearId || prev.academicYearId,
            term: openInv.term || prev.term,
            amountPaid: openInv.balance > 0 ? openInv.balance.toString() : '',
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load student invoices:', err);
    } finally {
      setPayStudentInvoicesLoading(false);
    }
  };

  const handleInvoiceSelectForPayment = (invoiceId: string) => {
    setPaymentForm((prev) => ({ ...prev, invoiceId }));
    const selectedInv = payStudentInvoices.find((i) => i.id === invoiceId);
    if (selectedInv) {
      setPaymentForm((prev) => ({
        ...prev,
        academicYearId: selectedInv.academicYearId || prev.academicYearId,
        term: selectedInv.term || prev.term,
        amountPaid: selectedInv.balance > 0 ? selectedInv.balance.toString() : prev.amountPaid,
      }));
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentFormError('');

    if (!paymentForm.studentId && !paymentForm.invoiceId) {
      setPaymentFormError('Please select a student or invoice.');
      return;
    }

    const amount = parseFloat(paymentForm.amountPaid);
    if (isNaN(amount) || amount <= 0) {
      setPaymentFormError('Please enter a valid amount greater than 0.');
      return;
    }

    setPaymentFormLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(paymentForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setPaymentFormError(data.error || 'Failed to record payment.');
        return;
      }

      setShowAddPaymentModal(false);
      setPaymentForm({
        studentId: '',
        invoiceId: '',
        academicYearId: '',
        term: 'Term 1',
        paymentDate: new Date().toISOString().split('T')[0],
        amountPaid: '',
        paymentMethod: 'Cash',
        referenceNo: '',
        notes: '',
      });
      setPaySelectedClassId('');
      setPayClassStudents([]);
      setPayStudentInvoices([]);
      setPaymentsNotice({ type: 'success', message: data.message || 'Payment recorded successfully!' });
      fetchPayments();
      fetchInvoices();
    } catch (err: any) {
      console.error('Error creating payment:', err);
      setPaymentFormError(err.message || 'Failed to record payment.');
    } finally {
      setPaymentFormLoading(false);
    }
  };

  const openEditPaymentModal = (pay: PaymentRecord) => {
    setEditingPayment(pay);
    setEditPaymentForm({
      amountPaid: pay.amountPaid.toString(),
      paymentMethod: pay.paymentMethod,
      referenceNo: pay.referenceNo || '',
      paymentDate: pay.paymentDate,
      notes: pay.notes || '',
    });
    setEditPaymentError('');
    setShowEditPaymentModal(true);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setEditPaymentError('');

    const amount = parseFloat(editPaymentForm.amountPaid);
    if (isNaN(amount) || amount <= 0) {
      setEditPaymentError('Amount paid must be greater than 0.');
      return;
    }

    setEditPaymentLoading(true);
    try {
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editPaymentForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditPaymentError(data.error || 'Failed to update payment.');
        return;
      }

      setShowEditPaymentModal(false);
      setEditingPayment(null);
      setPaymentsNotice({ type: 'success', message: data.message || 'Payment updated successfully.' });
      fetchPayments();
      fetchInvoices();
    } catch (err: any) {
      console.error('Error updating payment:', err);
      setEditPaymentError(err.message || 'Failed to update payment.');
    } finally {
      setEditPaymentLoading(false);
    }
  };

  const openDeletePaymentModal = (pay: PaymentRecord) => {
    setDeletingPayment(pay);
    setShowDeletePaymentModal(true);
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    setDeletePaymentLoading(true);
    try {
      const res = await fetch(`/api/payments/${deletingPayment.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPaymentsNotice({ type: 'error', message: data.error || 'Failed to delete payment.' });
        return;
      }
      setShowDeletePaymentModal(false);
      setDeletingPayment(null);
      setPaymentsNotice({ type: 'success', message: data.message || 'Payment deleted successfully.' });
      fetchPayments();
      fetchInvoices();
    } catch (err) {
      console.error('Failed to delete payment:', err);
    } finally {
      setDeletePaymentLoading(false);
    }
  };

  const openReceiptPreview = (pay: PaymentRecord) => {
    setSelectedPaymentForReceipt(pay);
    setShowReceiptPreviewModal(true);
  };

  const filteredPayments = payments.filter((pay) => {
    const q = paymentsSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      pay.transactionId.toLowerCase().includes(q) ||
      pay.receiptNumber.toLowerCase().includes(q) ||
      pay.studentName.toLowerCase().includes(q) ||
      pay.studentId.toLowerCase().includes(q) ||
      pay.studentClass.toLowerCase().includes(q) ||
      pay.invoiceNumber.toLowerCase().includes(q) ||
      pay.paymentMethod.toLowerCase().includes(q) ||
      pay.referenceNo.toLowerCase().includes(q) ||
      pay.notes.toLowerCase().includes(q)
    );
  });

  // Calculate payments metrics
  const totalPaymentsCollected = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const totalPaymentsCount = payments.length;
  const avgPaymentAmount = totalPaymentsCount > 0 ? totalPaymentsCollected / totalPaymentsCount : 0;
  const totalOutstandingBalance = invoicesList.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);

  // Compute Class Breakdown metrics for progress bars & table
  const classPaymentMetrics = classesList.map((cls) => {
    const classPayments = payments.filter((p) => p.studentClassId === cls.id || p.studentClass === cls.name);
    const classInvoices = invoicesList.filter((inv) => inv.student?.classId === cls.id || inv.student?.class?.name === cls.name);

    const collected = classPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const expected = classInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
    const balance = Math.max(0, expected - collected);
    const paidRatio = expected > 0 ? Math.min(1, collected / expected) : 0;
    const progressPercent = Math.round(paidRatio * 100);

    return {
      id: cls.id,
      name: cls.name,
      studentCount: cls._count?.students || 0,
      expected,
      collected,
      balance,
      progressPercent,
    };
  });

  // Reports Handler
  const fetchReports = async (yearFilter?: string, termFilter?: string, classFilter?: string) => {
    if (!token) return;
    setReportsLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set('academicYear', yearFilter);
      if (termFilter) params.set('term', termFilter);
      if (classFilter) params.set('classId', classFilter);
      const res = await fetch(`/api/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReportsData(data);
        setReportsFetched(true);
      }
    } catch (err) {
      console.error('Reports fetch error:', err);
    } finally {
      setReportsLoading(false);
    }
  };

  // Settings Handlers
  const fetchSettings = async () => {
    if (!token) return;
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTenantSettings(data);
        if (data.tenant) {
          setTenant(data.tenant);
          try {
            localStorage.setItem('sms_tenant', JSON.stringify(data.tenant));
          } catch (e) {
            console.error(e);
          }
          setProfileForm({
            name: data.tenant.name || '',
            alias: data.tenant.alias || '',
            logoUrl: data.tenant.logoUrl || '',
            address: data.tenant.address || '',
            email: data.tenant.email || '',
            phone: data.tenant.phone || '',
            currency: data.tenant.currency || 'GHS',
          });
        }
        if (data.scorePercentages) {
          setGradingForm({
            classScore: data.scorePercentages.classScore ?? 50,
            examScore: data.scorePercentages.examScore ?? 50,
            passingMark: data.scorePercentages.passingMark ?? 50,
          });
        }
        setSettingsFetched(true);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings' && token) {
      fetchSettings();
    }
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab === 'reports' && token && !reportsFetched) {
      fetchReports(reportFilterYear, reportFilterTerm, reportFilterClass);
    }
  }, [activeTab, token]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileSaving(true);
    setSettingsNotice(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile: profileForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsNotice({ type: 'error', message: data.error || 'Failed to update profile.' });
        return;
      }
      if (data.tenant) {
        setTenant(data.tenant);
        localStorage.setItem('sms_tenant', JSON.stringify(data.tenant));
      }
      setSettingsNotice({ type: 'success', message: 'School profile saved successfully!' });
      fetchSettings();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setSettingsNotice({ type: 'error', message: err.message || 'Failed to save profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const processLogoFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file (PNG, JPG, WebP, or SVG).'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image must be under 5MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) {
          reject(new Error('Empty file content.'));
          return;
        }

        // SVG files can be stored directly
        if (file.type === 'image/svg+xml') {
          resolve(result);
          return;
        }

        const img = new Image();
        img.onerror = () => reject(new Error('Failed to parse image.'));
        img.onload = () => {
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png', 0.9));
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDirectSidebarLogoUpload = async (file: File) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const dataUrl = await processLogoFile(file);
      if (!token) {
        setTenant((prev) => (prev ? { ...prev, logoUrl: dataUrl } : null));
        setProfileForm((prev) => ({ ...prev, logoUrl: dataUrl }));
        return;
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profile: {
            logoUrl: dataUrl,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update logo.');

      if (data.tenant) {
        setTenant(data.tenant);
        localStorage.setItem('sms_tenant', JSON.stringify(data.tenant));
      } else {
        setTenant((prev) => (prev ? { ...prev, logoUrl: dataUrl } : null));
      }
      setProfileForm((prev) => ({ ...prev, logoUrl: dataUrl }));
      setSettingsNotice({ type: 'success', message: 'School logo uploaded and saved successfully!' });
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      alert(err.message || 'Failed to upload logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleProfileLogoUpload = async (file: File) => {
    if (!file) return;
    try {
      const dataUrl = await processLogoFile(file);
      setProfileForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    } catch (err: any) {
      alert(err.message || 'Failed to process logo.');
    }
  };

  const handleSaveGradingWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const total = Math.round(Number(gradingForm.classScore) + Number(gradingForm.examScore));
    if (total !== 100) {
      setSettingsNotice({
        type: 'error',
        message: `Scores must equal 100%. Current sum: ${total}% (${gradingForm.classScore}% class + ${gradingForm.examScore}% exam).`,
      });
      return;
    }
    setGradingSaving(true);
    setSettingsNotice(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scorePercentages: gradingForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsNotice({ type: 'error', message: data.error || 'Failed to update grading weights.' });
        return;
      }
      setSettingsNotice({ type: 'success', message: 'Grading weights updated successfully!' });
      fetchSettings();
    } catch (err: any) {
      console.error('Error saving grading:', err);
      setSettingsNotice({ type: 'error', message: err.message || 'Failed to save grading weights.' });
    } finally {
      setGradingSaving(false);
    }
  };

  const openParamModal = (paramItem: SystemParamItem) => {
    setEditingParam(paramItem);
    setEditParamValue(paramItem.value);
    setShowEditParamModal(true);
  };

  const handleSaveParam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParam || !token) return;
    setEditParamLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          parameters: {
            param: editingParam.param,
            value: editParamValue,
            category: editingParam.category,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsNotice({ type: 'error', message: data.error || 'Failed to update parameter.' });
        return;
      }
      setShowEditParamModal(false);
      setEditingParam(null);
      setSettingsNotice({ type: 'success', message: `Parameter "${editingParam.param}" updated!` });
      fetchSettings();
    } catch (err: any) {
      console.error('Error saving param:', err);
      setSettingsNotice({ type: 'error', message: err.message || 'Failed to save parameter.' });
    } finally {
      setEditParamLoading(false);
    }
  };

  const openAddListItemModal = (type: 'categories' | 'methods') => {
    setListModalType(type);
    setListModalOldValue(null);
    setListModalInputValue('');
    setShowListModal(true);
  };

  const openEditListItemModal = (type: 'categories' | 'methods', val: string) => {
    setListModalType(type);
    setListModalOldValue(val);
    setListModalInputValue(val);
    setShowListModal(true);
  };

  const handleSaveListItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = listModalInputValue.trim();
    if (!val || !token) return;
    setListModalLoading(true);
    try {
      const currentList = tenantSettings?.lists[listModalType] || [];
      let updatedList: string[];
      if (listModalOldValue) {
        updatedList = currentList.map((item) => (item === listModalOldValue ? val : item));
      } else {
        if (currentList.includes(val)) {
          setSettingsNotice({ type: 'error', message: `Item "${val}" already exists in the list.` });
          setListModalLoading(false);
          return;
        }
        updatedList = [...currentList, val];
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lists: { [listModalType]: updatedList } }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsNotice({ type: 'error', message: data.error || 'Failed to update list.' });
        return;
      }
      setShowListModal(false);
      setSettingsNotice({ type: 'success', message: 'List updated successfully!' });
      fetchSettings();
    } catch (err: any) {
      console.error('Error saving list item:', err);
      setSettingsNotice({ type: 'error', message: err.message || 'Failed to update list.' });
    } finally {
      setListModalLoading(false);
    }
  };

  const handleDeleteListItem = async (type: 'categories' | 'methods', val: string) => {
    if (!token) return;
    const currentList = tenantSettings?.lists[type] || [];
    const updatedList = currentList.filter((item) => item !== val);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lists: { [type]: updatedList } }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsNotice({ type: 'error', message: data.error || 'Failed to remove item.' });
        return;
      }
      setSettingsNotice({ type: 'success', message: `Removed "${val}" from list.` });
      fetchSettings();
    } catch (err: any) {
      console.error('Error deleting list item:', err);
    }
  };

  const handleDownloadBackup = async () => {
    if (!token) return;
    setBackupLoading(true);
    setSettingsNotice(null);
    try {
      const res = await fetch('/api/settings/backup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSettingsNotice({ type: 'error', message: data.error || 'Failed to export backup.' });
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `sms_backup_${tenant?.subdomain || 'tenant'}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSettingsNotice({ type: 'success', message: 'Complete tenant backup exported successfully!' });
      fetchSettings();
    } catch (err: any) {
      console.error('Error downloading backup:', err);
      setSettingsNotice({ type: 'error', message: err.message || 'Failed to download backup.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const fetchGatewaySettings = async () => {
    if (!token) return;
    setGatewaysLoading(true);
    try {
      const res = await fetch('/api/settings/payment-gateways', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setGatewaySettings((prev) => ({
            ...prev,
            ...data.settings,
            paystack: { ...prev.paystack, ...data.settings.paystack },
            flutterwave: { ...prev.flutterwave, ...data.settings.flutterwave },
            stripe: { ...prev.stripe, ...data.settings.stripe },
          }));
          if (data.settings.defaultGateway) {
            setSelectedCheckoutGateway(data.settings.defaultGateway);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load gateway settings:', err);
    } finally {
      setGatewaysLoading(false);
    }
  };

  const handleSaveGatewaySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setGatewaysSaving(true);
    setGatewaysNotice(null);
    try {
      const res = await fetch('/api/settings/payment-gateways', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(gatewaySettings),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGatewaysNotice({ type: 'success', message: 'Payment gateway configurations saved successfully!' });
        if (data.settings) {
          setGatewaySettings((prev) => ({
            ...prev,
            ...data.settings,
            paystack: { ...prev.paystack, ...data.settings.paystack },
            flutterwave: { ...prev.flutterwave, ...data.settings.flutterwave },
            stripe: { ...prev.stripe, ...data.settings.stripe },
          }));
        }
      } else {
        setGatewaysNotice({ type: 'error', message: data.error || 'Failed to save gateway configuration.' });
      }
    } catch (err: any) {
      setGatewaysNotice({ type: 'error', message: err.message || 'Network error saving gateway settings.' });
    } finally {
      setGatewaysSaving(false);
    }
  };

  const handleCopyWebhook = () => {
    const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/subscriptions/webhook`;
    navigator.clipboard?.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };



  // SVG Chart 1: Payment Status by Class (Paid in Green #10b981 vs Unpaid in Red #ef4444)
  const renderPaymentStatusChart = () => {
    const items =
      paymentStatusData.length > 0
        ? paymentStatusData
        : classesList.length > 0
        ? classesList.slice(0, 5).map((c) => ({ className: c.name, paidStudents: 0, unpaidStudents: 0 }))
        : [];

    if (items.length === 0) {
      return (
        <div className="w-full h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400">
          <span className="text-2xl mb-1">💳</span>
          <p className="text-xs font-semibold text-slate-600">No payment data recorded</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Classes and invoices will reflect student payment status here.</p>
        </div>
      );
    }

    const maxVal = Math.max(1, ...items.map((i) => Math.max(i.paidStudents, i.unpaidStudents)));
    const ticks = [1.0, 0.8, 0.6, 0.4, 0.2, 0.0].map((t) => Number((t * maxVal).toFixed(1)));
    const uniqueTicks = Array.from(new Set(ticks)).sort((a, b) => b - a);

    const chartW = 340;
    const chartH = 140;
    const chartL = 42;
    const chartT = 20;
    const chartB = chartT + chartH;

    const slotW = (chartW - chartL) / items.length;
    const barW = Math.min(18, Math.max(10, (slotW - 16) / 2));

    return (
      <div className="w-full">
        <svg viewBox="0 0 360 200" className="w-full h-48 select-none">
          {/* Y Axis Label */}
          <text
            x={12}
            y={chartT + chartH / 2}
            textAnchor="middle"
            fontSize="9"
            fill={darkMode ? '#94a3b8' : '#94a3b8'}
            transform={`rotate(-90 12 ${chartT + chartH / 2})`}
            className="font-medium"
          >
            Number of Students
          </text>

          {/* Grid lines and tick labels */}
          {uniqueTicks.map((val) => {
            const y = chartB - (val / (maxVal || 1)) * chartH;
            return (
              <g key={val}>
                <line
                  x1={chartL}
                  y1={y}
                  x2={chartW}
                  y2={y}
                  stroke={darkMode ? '#334155' : '#f1f5f9'}
                  strokeWidth="1"
                  strokeDasharray={val === 0 ? 'none' : '3 3'}
                />
                <text
                  x={chartL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill={darkMode ? '#94a3b8' : '#94a3b8'}
                  className="font-mono"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {items.map((item, idx) => {
            const cx = chartL + idx * slotW + slotW / 2;
            const paidH = (item.paidStudents / (maxVal || 1)) * chartH;
            const unpaidH = (item.unpaidStudents / (maxVal || 1)) * chartH;

            const paidX = cx - barW - 2;
            const unpaidX = cx + 2;

            return (
              <g key={item.className}>
                {/* Paid Bar (Green) */}
                <rect
                  x={paidX}
                  y={chartB - paidH}
                  width={barW}
                  height={Math.max(paidH, 0)}
                  rx={3}
                  fill="#10b981"
                  className="transition-all duration-300 hover:opacity-80"
                >
                  <title>{`${item.className} - Paid: ${item.paidStudents}`}</title>
                </rect>
                {item.paidStudents > 0 && (
                  <text
                    x={paidX + barW / 2}
                    y={chartB - paidH - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#10b981"
                    fontWeight="bold"
                  >
                    {item.paidStudents}
                  </text>
                )}

                {/* Unpaid Bar (Red) */}
                <rect
                  x={unpaidX}
                  y={chartB - unpaidH}
                  width={barW}
                  height={Math.max(unpaidH, 0)}
                  rx={3}
                  fill="#ef4444"
                  className="transition-all duration-300 hover:opacity-80"
                >
                  <title>{`${item.className} - Unpaid: ${item.unpaidStudents}`}</title>
                </rect>
                {item.unpaidStudents > 0 && (
                  <text
                    x={unpaidX + barW / 2}
                    y={chartB - unpaidH - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#ef4444"
                    fontWeight="bold"
                  >
                    {item.unpaidStudents}
                  </text>
                )}

                {/* Class Label */}
                <text
                  x={cx}
                  y={chartB + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill={darkMode ? '#cbd5e1' : '#64748b'}
                  fontWeight="500"
                >
                  {item.className}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // SVG Chart 2: Attendance Trend (Area Line Chart)
  const renderAttendanceTrendChart = () => {
    const defaultPoints = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (5 - i));
      return {
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        percentage: 0,
      };
    });
    const trendPoints =
      attendanceTrendData.length >= 2
        ? attendanceTrendData
        : defaultPoints;

    const chartW = 340;
    const chartH = 140;
    const chartL = 42;
    const chartT = 20;
    const chartB = chartT + chartH;

    const yTicks = [100, 80, 60, 40, 20, 0];
    const stepX = (chartW - chartL) / (trendPoints.length - 1 || 1);

    const coords = trendPoints.map((pt, i) => {
      const x = chartL + i * stepX;
      const y = chartB - (pt.percentage / 100) * chartH;
      return { x, y, ...pt };
    });

    const pathD = coords.reduce((acc, curr, i) => {
      return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${chartB} L ${coords[0].x} ${chartB} Z`;

    return (
      <div className="w-full">
        <svg viewBox="0 0 360 200" className="w-full h-48 select-none">
          <defs>
            <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = chartB - (tick / 100) * chartH;
            return (
              <g key={tick}>
                <line
                  x1={chartL}
                  y1={y}
                  x2={chartW}
                  y2={y}
                  stroke={darkMode ? '#334155' : '#f1f5f9'}
                  strokeWidth="1"
                  strokeDasharray={tick === 0 ? 'none' : '3 3'}
                />
                <text
                  x={chartL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill={darkMode ? '#94a3b8' : '#94a3b8'}
                  className="font-mono"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Gradient area */}
          <path d={areaD} fill="url(#attendanceGradient)" />

          {/* Stroke path */}
          <path
            d={pathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots and Labels */}
          {coords.map((pt, i) => (
            <g key={i}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={3.5}
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth="2"
                className="hover:scale-125 transition-transform"
              >
                <title>{`${pt.label}: ${pt.percentage}%`}</title>
              </circle>
              <text
                x={pt.x}
                y={chartB + 18}
                textAnchor="middle"
                fontSize="9"
                fill={darkMode ? '#cbd5e1' : '#64748b'}
                fontWeight="500"
              >
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // SVG Chart 3: Students by Class (Blue Vertical Bars)
  const renderStudentsByClassChart = () => {
    const items =
      studentsByClassData.length > 0
        ? studentsByClassData
        : classesList.length > 0
        ? classesList.slice(0, 6).map((c) => ({ className: c.name, studentCount: 0 }))
        : [];

    if (items.length === 0) {
      return (
        <div className="w-full h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400">
          <span className="text-2xl mb-1">🏫</span>
          <p className="text-xs font-semibold text-slate-600">No classes configured yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Classes and enrolled pupils will display here.</p>
        </div>
      );
    }

    const maxVal = Math.max(1, ...items.map((i) => i.studentCount));
    const ticks = [1.0, 0.8, 0.6, 0.4, 0.2, 0.0].map((t) => Number((t * maxVal).toFixed(1)));
    const uniqueTicks = Array.from(new Set(ticks)).sort((a, b) => b - a);

    const chartW = 340;
    const chartH = 140;
    const chartL = 42;
    const chartT = 20;
    const chartB = chartT + chartH;

    const slotW = (chartW - chartL) / items.length;
    const barW = Math.min(26, Math.max(14, slotW - 20));

    return (
      <div className="w-full">
        <svg viewBox="0 0 360 200" className="w-full h-48 select-none">
          {/* Grid lines and tick values */}
          {uniqueTicks.map((val) => {
            const y = chartB - (val / (maxVal || 1)) * chartH;
            return (
              <g key={val}>
                <line
                  x1={chartL}
                  y1={y}
                  x2={chartW}
                  y2={y}
                  stroke={darkMode ? '#334155' : '#f1f5f9'}
                  strokeWidth="1"
                  strokeDasharray={val === 0 ? 'none' : '3 3'}
                />
                <text
                  x={chartL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill={darkMode ? '#94a3b8' : '#94a3b8'}
                  className="font-mono"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {items.map((item, idx) => {
            const cx = chartL + idx * slotW + slotW / 2;
            const barH = (item.studentCount / (maxVal || 1)) * chartH;
            const barX = cx - barW / 2;

            return (
              <g key={item.className}>
                <rect
                  x={barX}
                  y={chartB - barH}
                  width={barW}
                  height={Math.max(barH, 0)}
                  rx={4}
                  fill="#3b82f6"
                  className="transition-all duration-300 hover:opacity-85"
                >
                  <title>{`${item.className}: ${item.studentCount} students`}</title>
                </rect>
                {item.studentCount > 0 && (
                  <text
                    x={cx}
                    y={chartB - barH - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#2563eb"
                    fontWeight="bold"
                  >
                    {item.studentCount}
                  </text>
                )}
                <text
                  x={cx}
                  y={chartB + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill={darkMode ? '#cbd5e1' : '#64748b'}
                  fontWeight="500"
                >
                  {item.className}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };


  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollLoading(true);
    setEnrollError('');
    setEnrollSuccess('');

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(enrollForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to enroll student');
      }

      setEnrollSuccess(`Student ${data.student.firstName} ${data.student.lastName} enrolled successfully!`);
      setEnrollForm({
        firstName: '',
        lastName: '',
        studentId: '',
        gender: 'Male',
        dateOfBirth: '',
        classId: '',
        guardianName: '',
        guardianPhone: '',
        guardianEmail: '',
      });
      fetchDashboardData();
      setTimeout(() => {
        setShowEnrollModal(false);
        setEnrollSuccess('');
      }, 1200);
    } catch (err: any) {
      setEnrollError(err.message);
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    setMigrationLoading(true);
    setMigrationResult(null);

    try {
      let parsed;
      try {
        parsed = JSON.parse(migrationPayload);
      } catch {
        throw new Error('Invalid JSON format. Please paste valid migration JSON from Google Sheets.');
      }

      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantSubdomain: tenant?.subdomain,
          migrationPayload: parsed,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Migration failed');

      const imp = data.imported || {};
      setMigrationResult(
        `✅ Migration Completed! Imported: ${imp.students || 0} students, ${imp.classes || 0} classes, ${imp.subjects || 0} subjects, ${imp.academicYears || 0} academic years, ${imp.billingCategories || 0} fee categories, ${imp.teachers || 0} teachers.`
      );
      fetchDashboardData();
    } catch (err: any) {
      setMigrationResult(`Error: ${err.message}`);
    } finally {
      setMigrationLoading(false);
    }
  };

  // Fetch import template when modal opens
  useEffect(() => {
    if (showImportModal && !importTemplate) {
      fetch('/api/students/import', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setImportTemplate(data.template);
          }
        })
        .catch(console.error);
    }
  }, [showImportModal, token, importTemplate]);

  const handleStudentImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportResult(null);

    try {
      let parsed;
      try {
        parsed = JSON.parse(importPayload);
      } catch {
        // Try parsing as CSV-like JSON array
        if (importPayload.trim().startsWith('[')) {
          parsed = JSON.parse(importPayload);
        } else {
          throw new Error('Invalid JSON format. Provide a valid JSON array of students.');
        }
      }

      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setImportResult(data);
      if (data.imported > 0) {
        fetchDashboardData();
        fetchStudents();
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        totalRows: 0,
        imported: 0,
        skipped: 0,
        errors: [{ row: 0, field: 'general', message: err.message }],
        summary: { withDateOfBirth: 0, withClass: 0, withGuardian: 0 },
      });
    } finally {
      setImportLoading(false);
    }
  };

  // Helper to fetch students list
  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
    }
  };

  // Handle Excel file upload
  const handleExcelUpload = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false,
          defval: '' 
        });
        
        // Transform the data to match our format
        const transformedData = jsonData.map((row: any) => ({
          studentId: row['Student ID'] || row['studentId'] || '',
          firstName: row['First Name'] || row['firstName'] || '',
          lastName: row['Last Name'] || row['lastName'] || '',
          gender: row['Gender'] || row['gender'] || '',
          dateOfBirth: row['Date of Birth'] || row['dateOfBirth'] || '',
          className: row['Class'] || row['className'] || '',
          guardianName: row['Guardian Name'] || row['guardianName'] || '',
          guardianPhone: row['Guardian Phone'] || row['guardianPhone'] || '',
          guardianEmail: row['Guardian Email'] || row['guardianEmail'] || '',
          address: row['Address'] || row['address'] || '',
        }));
        
        setImportPayload(JSON.stringify(transformedData, null, 2));
      } catch (error) {
        console.error('Error reading Excel file:', error);
        setImportResult({
          success: false,
          totalRows: 0,
          imported: 0,
          skipped: 0,
          errors: [{ row: 0, field: 'file', message: 'Failed to read Excel file. Please check the format.' }],
          summary: { withDateOfBirth: 0, withClass: 0, withGuardian: 0 },
        });
      }
    };
    
    reader.readAsBinaryString(file);
  };

  // Download Excel template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Student ID': 'STU001',
        'First Name': 'John',
        'Last Name': 'Doe',
        'Gender': 'Male',
        'Date of Birth': '2015-05-15',
        'Class': importTemplate?.availableClasses[0]?.name || 'Primary 1',
        'Guardian Name': 'Jane Doe',
        'Guardian Phone': '0241234567',
        'Guardian Email': 'jane@example.com',
        'Address': '123 Main Street, Accra',
      },
      {
        'Student ID': 'STU002',
        'First Name': 'Mary',
        'Last Name': 'Smith',
        'Gender': 'Female',
        'Date of Birth': '2016-03-20',
        'Class': importTemplate?.availableClasses[0]?.name || 'Primary 1',
        'Guardian Name': 'Robert Smith',
        'Guardian Phone': '0207654321',
        'Guardian Email': 'robert@example.com',
        'Address': '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    
    // Set column widths
    const maxWidth = 20;
    worksheet['!cols'] = [
      { wch: 12 }, // Student ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 10 }, // Gender
      { wch: 15 }, // Date of Birth
      { wch: 15 }, // Class
      { wch: 20 }, // Guardian Name
      { wch: 15 }, // Guardian Phone
      { wch: 25 }, // Guardian Email
      { wch: 30 }, // Address
    ];
    
    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `Student_Import_Template_${today}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
  };

  const handleSignOut = () => {
    // Clears the stored session, records the sign-out server-side (audit log)
    // and returns to the login screen.
    session.signOut('manual');
  };

  const handleTopnavSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim().length > 0) {
      setSearchDropdownOpen(true);
    } else {
      setSearchDropdownOpen(false);
    }

    // Contextual Sync with Active Tab's filter
    const lower = val.trim();
    if (activeTab === 'teachers') setTeacherSearchQuery(lower);
    else if (activeTab === 'classes') setClassSearchQuery(lower);
    else if (activeTab === 'subjects') setSubjectSearchQuery(lower);
    else if (activeTab === 'billing') setInvoiceSearchQuery(lower);
    else if (activeTab === 'academic-years') setYearSearchQuery(lower);
    else if (activeTab === 'users') setUserSearchQuery(lower);
    else if (activeTab === 'parents') setParentSearchQuery(lower);
    else if (activeTab === 'permissions') setPermissionSearchQuery(lower);
    else if (activeTab === 'attendance') setAttendanceSearchQuery(lower);
    else if (activeTab === 'performance') setPerformanceSearchQuery(lower);
  };

  const handleClearTopnavSearch = () => {
    setSearchQuery('');
    setSearchDropdownOpen(false);
    if (activeTab === 'teachers') setTeacherSearchQuery('');
    else if (activeTab === 'classes') setClassSearchQuery('');
    else if (activeTab === 'subjects') setSubjectSearchQuery('');
    else if (activeTab === 'billing') setInvoiceSearchQuery('');
    else if (activeTab === 'academic-years') setYearSearchQuery('');
    else if (activeTab === 'users') setUserSearchQuery('');
    else if (activeTab === 'parents') setParentSearchQuery('');
    else if (activeTab === 'permissions') setPermissionSearchQuery('');
    else if (activeTab === 'attendance') setAttendanceSearchQuery('');
    else if (activeTab === 'performance') setPerformanceSearchQuery('');
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    return (
      fullName.includes(q) ||
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      (s.guardianName && s.guardianName.toLowerCase().includes(q))
    );
  });

  // Topnav Global Omnisearch Pages & Modules Definition
  // (perm = permission page key; pages the current user cannot see never show up in search)
  const NAVIGATION_PAGES = [
    { id: 'overview', name: 'Dashboard Overview', desc: 'Real-time KPIs & operational summaries', icon: '📊', tab: 'overview', perm: 'overview' },
    { id: 'students', name: 'Students Directory', desc: 'Enrollment, student profiles & records', icon: '🎓', tab: 'students', perm: 'students' },
    { id: 'teachers', name: 'Teachers & Faculty Directory', desc: 'Faculty staff, classes & contacts', icon: '👨‍🏫', tab: 'teachers', perm: 'teachers' },
    { id: 'classes', name: 'Classes & Streams', desc: 'Classrooms, streams & form teachers', icon: '🏫', tab: 'classes', perm: 'classes' },
    { id: 'subjects', name: 'Subjects Curriculum', desc: 'GES courses, subject assignments', icon: '📚', tab: 'subjects', perm: 'subjects' },
    { id: 'attendance', name: 'Attendance Register', desc: 'Daily attendance logs & absentees', icon: '📅', tab: 'attendance', perm: 'attendance' },
    { id: 'performance', name: 'Assessment & GES Scores', desc: 'Continuous assessments & terminal exams', icon: '📝', tab: 'performance', perm: 'performance' },
    { id: 'terminal-report', name: 'Terminal Report Cards', desc: 'Printable WAEC/GES terminal report cards', icon: '📋', tab: 'performance', action: 'terminal_report', perm: 'performance' },
    { id: 'billing', name: 'Fees & Invoicing', desc: 'Fee categories, student bills & items', icon: '🧾', tab: 'billing', perm: 'billing_items' },
    { id: 'payments', name: 'Payment Records', desc: 'Receipts, MoMo payments & fee ledger', icon: '💰', tab: 'payments', perm: 'payments' },
    { id: 'reports', name: 'Reports & Analytics', desc: 'Academic, financial & attendance reports', icon: '📈', tab: 'reports', perm: 'reports' },
    { id: 'academic-years', name: 'Academic Years & Terms', desc: 'Active school terms & semester configuration', icon: '🗓️', tab: 'academic-years', perm: 'academic_years' },
    { id: 'subscription', name: 'Subscription & Licensing', desc: 'Plan upgrade, quotas & online renewal', icon: '💳', tab: 'subscription', perm: 'subscription' },
    { id: 'settings', name: 'School Profile Settings', desc: 'School name, logo, grading scale & lists', icon: '⚙️', tab: 'settings', subTab: 'profile', perm: 'settings' },
    { id: 'gateways', name: 'Payment Gateways Config', desc: 'Paystack, Flutterwave, Stripe credentials', icon: '💳', tab: 'settings', subTab: 'gateways', perm: 'settings' },
    { id: 'users', name: 'System Users', desc: 'Staff logins, administrators & credentials', icon: '👥', tab: 'users', perm: 'users' },
    { id: 'permissions', name: 'Permissions Matrix', desc: 'Role capabilities & administrative rights', icon: '🛡️', tab: 'permissions', perm: 'permissions' },
    { id: 'parents', name: 'Parent Portals', desc: 'Student-guardian mapping & portal access', icon: '👨‍👩‍👧', tab: 'parents', perm: 'parents' },
    // Operations & Marketing department pages (from the department registry)
    ...DEPARTMENT_RESOURCES.map((resource) => ({
      id: resource.tab,
      name: resource.title,
      desc: resource.description,
      icon: resource.icon,
      tab: resource.tab,
      perm: resource.permKey,
    })),
  ].filter((p) => can(p.perm, 'view'));

  const searchNormalized = searchQuery.trim().toLowerCase();

  const matchedStudents = searchNormalized
    ? students
        .filter((s) => {
          const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
          const id = (s.studentId || '').toLowerCase();
          const cls = (s.class?.name || '').toLowerCase();
          const guardian = (s.guardianName || '').toLowerCase();
          return (
            fullName.includes(searchNormalized) ||
            id.includes(searchNormalized) ||
            cls.includes(searchNormalized) ||
            guardian.includes(searchNormalized)
          );
        })
        .slice(0, 5)
    : [];

  const matchedTeachers = searchNormalized
    ? teachers
        .filter((t) => {
          const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
          const id = (t.teacherId || '').toLowerCase();
          const cls = (t.className || '').toLowerCase();
          return fullName.includes(searchNormalized) || id.includes(searchNormalized) || cls.includes(searchNormalized);
        })
        .slice(0, 4)
    : [];

  const matchedClasses = searchNormalized
    ? classesList
        .filter((c) => {
          const name = (c.name || '').toLowerCase();
          const teacher = (c.classTeacher?.fullName || '').toLowerCase();
          return name.includes(searchNormalized) || teacher.includes(searchNormalized);
        })
        .slice(0, 4)
    : [];

  const matchedSubjects = searchNormalized
    ? subjects
        .filter((s) => {
          const name = (s.name || '').toLowerCase();
          const instructor = (s.instructorName || '').toLowerCase();
          return name.includes(searchNormalized) || instructor.includes(searchNormalized);
        })
        .slice(0, 3)
    : [];

  const matchedInvoices = searchNormalized
    ? invoicesList
        .filter((inv) => {
          const num = (inv.invoiceNumber || inv.id || '').toLowerCase();
          const sName = `${inv.student?.firstName || ''} ${inv.student?.lastName || ''}`.toLowerCase();
          const status = (inv.status || '').toLowerCase();
          return num.includes(searchNormalized) || sName.includes(searchNormalized) || status.includes(searchNormalized);
        })
        .slice(0, 4)
    : [];

  const matchedPages = searchNormalized
    ? NAVIGATION_PAGES.filter(
        (p) =>
          p.name.toLowerCase().includes(searchNormalized) ||
          p.desc.toLowerCase().includes(searchNormalized) ||
          p.tab.toLowerCase().includes(searchNormalized)
      ).slice(0, 4)
    : [];

  const totalSearchResults =
    matchedStudents.length +
    matchedTeachers.length +
    matchedClasses.length +
    matchedSubjects.length +
    matchedInvoices.length +
    matchedPages.length;

  const topFirstSearchResult =
    matchedStudents.length > 0
      ? () => {
          const s = matchedStudents[0];
          setActiveTab('students');
          setSearchQuery(`${s.firstName} ${s.lastName}`);
          setSearchDropdownOpen(false);
        }
      : matchedTeachers.length > 0
      ? () => {
          const t = matchedTeachers[0];
          setActiveTab('teachers');
          setTeacherSearchQuery(`${t.firstName} ${t.lastName}`);
          setSearchDropdownOpen(false);
        }
      : matchedClasses.length > 0
      ? () => {
          const c = matchedClasses[0];
          setActiveTab('classes');
          setClassSearchQuery(c.name);
          setSearchDropdownOpen(false);
        }
      : matchedInvoices.length > 0
      ? () => {
          const inv = matchedInvoices[0];
          setActiveTab('billing');
          setInvoiceSearchQuery(inv.invoiceNumber || inv.id);
          setSearchDropdownOpen(false);
        }
      : matchedSubjects.length > 0
      ? () => {
          const s = matchedSubjects[0];
          setActiveTab('subjects');
          setSubjectSearchQuery(s.name);
          setSearchDropdownOpen(false);
        }
      : matchedPages.length > 0
      ? () => {
          const p = matchedPages[0];
          setActiveTab(p.tab as any);
          if ((p as any).subTab) setSettingsActiveSubTab((p as any).subTab);
          if ((p as any).action === 'terminal_report') setShowTerminalReportModal(true);
          setSearchDropdownOpen(false);
        }
      : null;

  const userInitials = user?.fullName

    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AS';

  // Nothing renders until the session has been verified. An expired, idle or
  // tampered token is redirected to the login screen by the guard instead of
  // flashing the dashboard shell.
  if (session.status !== 'authenticated') {
    return (
      <SessionCheckingScreen
        message={
          session.status === 'checking' ? 'Verifying your session…' : 'Redirecting to sign in…'
        }
      />
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} flex font-sans transition-colors duration-200`}>

      {/* Inactivity countdown - appears shortly before the auto sign-out */}
      <SessionTimeoutDialog
        open={session.warningVisible}
        secondsRemaining={session.secondsRemaining}
        idleMinutes={session.idleMinutes}
        onStaySignedIn={session.extendSession}
        onSignOut={() => session.signOut('manual')}
      />

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* FIXED SCROLLABLE SIDEBAR (MATCHING SCREENSHOT) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header: Logo + School Alias / Name */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Hidden file input for uploading logo from local device */}
            <input
              type="file"
              ref={sidebarLogoInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleDirectSidebarLogoUpload(file);
                e.target.value = '';
              }}
            />
            {/* Logo container with click to upload & hover badge */}
            <div
              onClick={() => sidebarLogoInputRef.current?.click()}
              className="group relative w-10 h-10 rounded-xl bg-[#1e293b] border border-blue-900/40 flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0 cursor-pointer"
              title="Click to upload logo from your device"
            >
              {tenant?.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.alias || tenant.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-700 border-2 border-white/90 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 2h2v7h7v2h-7v11h-2V11H4V9h7V2z" />
                  </svg>
                </div>
              )}
              {/* Hover upload overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                {logoUploading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>📷</span>
                )}
              </div>
            </div>
            <div className="overflow-hidden">
              <h2
                className="font-black text-base text-slate-900 tracking-tight truncate uppercase"
                title={tenant?.name || tenant?.alias || ''}
              >
                {tenant?.alias || tenant?.name || 'GEBSCO'}
              </h2>
              {tenant?.alias && tenant?.name && tenant?.alias !== tenant?.name && (
                <p className="text-[10px] text-slate-400 font-medium truncate leading-tight" title={tenant.name}>
                  {tenant.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-sidebar-scroll">
          {/* Active / Inactive Dashboard */}
          {can('overview') && (
              <button
                onClick={() => {
                  setActiveTab('overview');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <DashboardIcon className="w-5 h-5 shrink-0" />
                <span>Dashboard</span>
              </button>
          )}

          {/* PEOPLE */}
          {[
            { id: 'students', label: 'Students', Icon: StudentsIcon, perm: 'students' },
            { id: 'teachers', label: 'Teachers', Icon: TeachersIcon, perm: 'teachers' },
            { id: 'users', label: 'Users', Icon: UsersIcon, perm: 'users' },
            { id: 'parents', label: 'Parents', Icon: ParentsIcon, perm: 'parents' },
            { id: 'permissions', label: 'Permissions', Icon: PermissionsIcon, perm: 'permissions' },
          ].some((item) => can(item.perm)) && (
            <SidebarGroup
              label="PEOPLE"
              groupKey="people"
              open={!!openNavGroups.people}
              hasActive={navGroupForTab(activeTab) === 'people'}
              onToggle={() => toggleNavGroup('people')}
            >
                {[
                  { id: 'students', label: 'Students', Icon: StudentsIcon, perm: 'students' },
                  { id: 'teachers', label: 'Teachers', Icon: TeachersIcon, perm: 'teachers' },
                  { id: 'users', label: 'Users', Icon: UsersIcon, perm: 'users' },
                  { id: 'parents', label: 'Parents', Icon: ParentsIcon, perm: 'parents' },
                  { id: 'permissions', label: 'Permissions', Icon: PermissionsIcon, perm: 'permissions' },
                ]
                  .filter((item) => can(item.perm))
                  .map(({ id, label, Icon }) => {
                    const active = activeTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setActiveTab(id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                          active
                            ? 'bg-blue-600 text-white font-semibold shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
            </SidebarGroup>
          )}

          {/* ACADEMICS */}
          {[
            { id: 'classes', perm: 'classes' },
            { id: 'subjects', perm: 'subjects' },
            { id: 'enrollments', perm: 'enrollments' },
            { id: 'attendance', perm: 'attendance' },
            { id: 'academic-years', perm: 'academic_years' },
            { id: 'performance', perm: 'performance' },
          ].some((item) => can(item.perm)) && (
            <SidebarGroup
              label="ACADEMICS"
              groupKey="academics"
              open={!!openNavGroups.academics}
              hasActive={navGroupForTab(activeTab) === 'academics'}
              onToggle={() => toggleNavGroup('academics')}
            >
                {[
                  { id: 'classes', label: 'Classes', Icon: ClassesIcon, perm: 'classes' },
                  { id: 'subjects', label: 'Subject', Icon: SubjectIcon, perm: 'subjects' },
                  { id: 'enrollments', label: 'Enrollments', Icon: EnrollmentsIcon, perm: 'enrollments' },
                  { id: 'attendance', label: 'Attendance', Icon: AttendanceIcon, perm: 'attendance' },
                  { id: 'academic-years', label: 'Academic Years', Icon: AcademicYearsIcon, perm: 'academic_years' },
                  { id: 'performance', label: 'Assessment', Icon: PerformanceIcon, perm: 'performance' },
                ]
                  .filter((item) => can(item.perm))
                  .map(({ id, label, Icon }) => {
                    const active = activeTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setActiveTab(id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                          active
                            ? 'bg-blue-600 text-white font-semibold shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
            </SidebarGroup>
          )}

          {/* FINANCE */}
          {(can('invoices') || can('payments') || can('billing_items') || can('billing_categories')) && (
            <SidebarGroup
              label="FINANCE"
              groupKey="finance"
              open={!!openNavGroups.finance}
              hasActive={navGroupForTab(activeTab) === 'finance'}
              onToggle={() => toggleNavGroup('finance')}
            >
                {can('invoices') && (
                    <button
                      onClick={() => { setActiveTab('invoices'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        activeTab === 'invoices'
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <InvoicesIcon className={`w-5 h-5 shrink-0 ${activeTab === 'invoices' ? 'text-white' : 'text-slate-500'}`} />
                      <span>Invoices</span>
                    </button>
                )}

                {can('payments') && (
                    <button
                      onClick={() => { setActiveTab('payments'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        activeTab === 'payments'
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <PaymentsIcon className={`w-5 h-5 shrink-0 ${activeTab === 'payments' ? 'text-white' : 'text-slate-500'}`} />
                      <span>Payments</span>
                    </button>
                )}

                {can('billing_items') && (
                    <button
                      onClick={() => {
                        setActiveTab('billing');
                        setBillingSubTab('items');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        activeTab === 'billing' && billingSubTab === 'items'
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <BillingsIcon className={`w-5 h-5 shrink-0 ${activeTab === 'billing' && billingSubTab === 'items' ? 'text-white' : 'text-slate-500'}`} />
                      <span>Billings</span>
                    </button>
                )}

                {can('billing_categories') && (
                    <button
                      onClick={() => {
                        setActiveTab('billing');
                        setBillingSubTab('categories');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        activeTab === 'billing' && billingSubTab === 'categories'
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <BillingCategoriesIcon className={`w-5 h-5 shrink-0 ${activeTab === 'billing' && billingSubTab === 'categories' ? 'text-white' : 'text-slate-500'}`} />
                      <span>Billing Categories</span>
                    </button>
                )}
            </SidebarGroup>
          )}

          {/* OPERATIONS & MARKETING — rendered from the department registry
              (src/lib/departments.ts) so new department pages appear here,
              in the permission matrix and in the API with one config entry. */}
          {DEPARTMENTS.map((department) => {
            const pages = department.resources.filter((resource) => can(resource.permKey));
            if (pages.length === 0) return null;
            return (
              <SidebarGroup
                key={department.key}
                label={department.navLabel}
                groupKey={department.key}
                open={!!openNavGroups[department.key]}
                hasActive={navGroupForTab(activeTab) === department.key}
                onToggle={() => toggleNavGroup(department.key)}
              >
                {pages.map((resource) => {
                  const active = activeTab === resource.tab;
                  return (
                    <button
                      key={resource.key}
                      onClick={() => {
                        setActiveTab(resource.tab);
                        setMobileMenuOpen(false);
                      }}
                      title={resource.description}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        active
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <DepartmentNavIcon
                        resourceKey={resource.key}
                        className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`}
                      />
                      <span className="truncate">{resource.navLabel}</span>
                    </button>
                  );
                })}
              </SidebarGroup>
            );
          })}

          {/* SYSTEM */}
          {(can('subscription') || can('settings') || can('reports') || can('migration')) && (
            <SidebarGroup
              label="SYSTEM"
              groupKey="system"
              open={!!openNavGroups.system}
              hasActive={navGroupForTab(activeTab) === 'system'}
              onToggle={() => toggleNavGroup('system')}
            >
              {can('subscription') && (
                <button
                  onClick={() => { setActiveTab('subscription'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                    activeTab === 'subscription'
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SubscriptionIcon className={`w-5 h-5 shrink-0 ${activeTab === 'subscription' ? 'text-white' : 'text-slate-500'}`} />
                    <span>Subscription</span>
                  </div>
                  {tenant?.subscription?.status === 'expiring_soon' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                      {tenant.subscription.daysRemaining}d
                    </span>
                  )}
                  {tenant?.subscription?.status === 'expired' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      Due
                    </span>
                  )}
                </button>
              )}

              {can('settings') && (
                <button
                  onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    activeTab === 'settings'
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <SettingsIcon className={`w-5 h-5 shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-slate-500'}`} />
                  <span>Settings</span>
                </button>
              )}

              {can('reports') && (
                <button
                  onClick={() => { setActiveTab('reports'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    activeTab === 'reports'
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <ReportsIcon className={`w-5 h-5 shrink-0 ${activeTab === 'reports' ? 'text-white' : 'text-slate-500'}`} />
                  <span>Reports</span>
                </button>
              )}

              {can('migration') && (
                <button
                  onClick={() => { setActiveTab('migration'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    activeTab === 'migration'
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <MigrationIcon className={`w-5 h-5 shrink-0 ${activeTab === 'migration' ? 'text-white' : 'text-slate-500'}`} />
                  <span>Sheets Migration</span>
                </button>
              )}
            </SidebarGroup>
          )}
        </div>

        {/* Pinned Bottom of Sidebar */}
        <div className="p-3 border-t border-slate-100 bg-white shrink-0 space-y-2">
          {/* Compact Quota Progress */}
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
              <span>Student Quota</span>
              <span className="font-bold text-slate-800">
                {stats?.studentCount || 0}/{tenant?.studentLimit || 15}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (stats?.quotaPercentage || 0) >= 90
                    ? 'bg-red-500'
                    : (stats?.quotaPercentage || 0) >= 70
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(stats?.quotaPercentage || 0, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400 font-medium">{tenant?.plan || 'DEMO'} Plan</span>
              {can('subscription') && (
                  <button
                    onClick={() => setActiveTab('subscription')}
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Upgrade ↗
                  </button>
              )}
            </div>
          </div>

          {/* RED LOGOUT BUTTON MATCHING SCREENSHOT */}
          <button
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98]"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA OFFSET BY SIDEBAR ON DESKTOP */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        {/* Top Header */}
        <header
          className={`sticky top-0 z-30 transition-colors backdrop-blur border-b ${
            darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'
          }`}
        >
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Hamburger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={`md:hidden p-2 rounded-lg ${
                  darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h1 className={`font-black text-lg sm:text-xl tracking-tight leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  Dashboard
                </h1>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} hidden sm:block truncate max-w-md`}>
                  Comprehensive school management and real-time operational analytics.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Global Omnisearch Bar */}
              <div ref={searchContainerRef} className="relative">
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search anything... (Ctrl+K)"
                    value={searchQuery}
                    onFocus={() => {
                      if (searchQuery.trim().length > 0) setSearchDropdownOpen(true);
                    }}
                    onChange={(e) => handleTopnavSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (topFirstSearchResult) {
                          topFirstSearchResult();
                        }
                      } else if (e.key === 'Escape') {
                        setSearchDropdownOpen(false);
                      }
                    }}
                    className={`w-32 xs:w-44 sm:w-56 md:w-64 lg:w-80 pl-8 pr-7 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                    }`}
                  />
                  <svg
                    className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>

                  {/* Clear Button */}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearTopnavSearch}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-4 h-4 flex items-center justify-center rounded-full text-xs font-bold"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Omnisearch Results Dropdown */}
                {searchDropdownOpen && searchQuery.trim().length > 0 && (
                  <div className="absolute right-0 sm:left-0 top-full mt-2 w-80 sm:w-96 md:w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100] overflow-hidden max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">
                        Found <span className="text-blue-600 font-bold">{totalSearchResults}</span> result{totalSearchResults === 1 ? '' : 's'} for &ldquo;{searchQuery}&rdquo;
                      </span>
                      <button
                        type="button"
                        onClick={handleClearTopnavSearch}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-[11px]"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Scrollable Results List */}
                    <div className="overflow-y-auto max-h-[60vh] divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Empty State */}
                      {totalSearchResults === 0 && (
                        <div className="p-6 text-center">
                          <div className="text-3xl mb-2">🔍</div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            No matches found for &ldquo;{searchQuery}&rdquo;
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                            Try searching for student names, IDs, teachers, classes, invoice numbers, or modules.
                          </p>
                          <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={() => { setActiveTab('students'); setSearchDropdownOpen(false); }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[11px] font-semibold hover:bg-blue-100"
                            >
                              🎓 Open Students
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveTab('teachers'); setSearchDropdownOpen(false); }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px] font-semibold hover:bg-emerald-100"
                            >
                              👨‍🏫 Open Teachers
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveTab('billing'); setSearchDropdownOpen(false); }}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[11px] font-semibold hover:bg-amber-100"
                            >
                              🧾 Open Billing
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 1. STUDENTS */}
                      {matchedStudents.length > 0 && (
                        <div className="p-2">
                          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>🎓 Students ({matchedStudents.length})</span>
                            <span className="text-blue-600 font-semibold">Jump to Student →</span>
                          </div>
                          {matchedStudents.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setActiveTab('students');
                                setSearchQuery(`${s.firstName} ${s.lastName}`);
                                setSearchDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-50/80 dark:hover:bg-slate-800 transition flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {s.firstName?.[0] || 'S'}
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 truncate">
                                    {s.firstName} {s.lastName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    ID: <span className="font-mono">{s.studentId}</span>
                                    {s.class?.name ? ` • ${s.class.name}` : ''}
                                    {s.guardianName ? ` • Guardian: ${s.guardianName}` : ''}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-slate-300 group-hover:text-blue-600 shrink-0 ml-2">
                                →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 2. TEACHERS */}
                      {matchedTeachers.length > 0 && (
                        <div className="p-2">
                          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>👨‍🏫 Teachers &amp; Faculty ({matchedTeachers.length})</span>
                            <span className="text-blue-600 font-semibold">Jump to Teacher →</span>
                          </div>
                          {matchedTeachers.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setActiveTab('teachers');
                                setTeacherSearchQuery(`${t.firstName} ${t.lastName}`);
                                setSearchDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-slate-800 transition flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {t.firstName?.[0] || 'T'}
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 truncate">
                                    {t.firstName} {t.lastName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    ID: <span className="font-mono">{t.teacherId}</span>
                                    {t.className ? ` • Class: ${t.className}` : ' • General Faculty'}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-slate-300 group-hover:text-emerald-600 shrink-0 ml-2">
                                →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 3. CLASSES */}
                      {matchedClasses.length > 0 && (
                        <div className="p-2">
                          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>🏫 Classes &amp; Streams ({matchedClasses.length})</span>
                            <span className="text-blue-600 font-semibold">Jump to Class →</span>
                          </div>
                          {matchedClasses.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setActiveTab('classes');
                                setClassSearchQuery(c.name);
                                setSearchDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-purple-50/80 dark:hover:bg-slate-800 transition flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  🏫
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 truncate">
                                    {c.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    Teacher: {c.classTeacher?.fullName || 'Unassigned'}{c._count?.students !== undefined ? ` • ${c._count.students} Students` : ''}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-slate-300 group-hover:text-purple-600 shrink-0 ml-2">
                                →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 4. INVOICES */}
                      {matchedInvoices.length > 0 && (
                        <div className="p-2">
                          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>🧾 Invoices &amp; Billing ({matchedInvoices.length})</span>
                            <span className="text-blue-600 font-semibold">Jump to Invoice →</span>
                          </div>
                          {matchedInvoices.map((inv) => (
                            <button
                              key={inv.id}
                              type="button"
                              onClick={() => {
                                setActiveTab('billing');
                                setInvoiceSearchQuery(inv.invoiceNumber || inv.id);
                                setSearchDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-50/80 dark:hover:bg-slate-800 transition flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  🧾
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 truncate">
                                    Invoice #{inv.invoiceNumber || inv.id.slice(0, 8)}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : 'Student'} • GHS {inv.totalAmount || 0} •{' '}
                                    <span className={inv.status === 'PAID' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                      {inv.status || 'UNPAID'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-slate-300 group-hover:text-amber-600 shrink-0 ml-2">
                                →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 5. SUBJECTS */}
                      {matchedSubjects.length > 0 && (
                        <div className="p-2">
                          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>📚 Subjects ({matchedSubjects.length})</span>
                            <span className="text-blue-600 font-semibold">Jump to Subject →</span>
                          </div>
                          {matchedSubjects.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setActiveTab('subjects');
                                setSubjectSearchQuery(s.name);
                                setSearchDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-slate-800 transition flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  📚
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 truncate">
                                    {s.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    Instructor: {s.instructorName || 'Unassigned'} • Semester: {s.semester || 'All'}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-slate-300 group-hover:text-indigo-600 shrink-0 ml-2">
                                →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 6. QUICK NAVIGATION */}
                      {matchedPages.length > 0 && (
                        <div className="p-2">
                          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>⚡ Quick Navigation ({matchedPages.length})</span>
                            <span className="text-blue-600 font-semibold">Jump to Page →</span>
                          </div>
                          {matchedPages.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(p.tab as any);
                                if ((p as any).subTab) {
                                  setSettingsActiveSubTab((p as any).subTab);
                                }
                                if ((p as any).action === 'terminal_report') {
                                  setShowTerminalReportModal(true);
                                }
                                setSearchDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                                  {p.icon}
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {p.desc}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-slate-300 group-hover:text-blue-600 shrink-0 ml-2">
                                →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dropdown Footer with shortcuts */}
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-2">
                        <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono text-[10px]">Enter</kbd> to jump</span>
                        <span>•</span>
                        <span><kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono text-[10px]">Esc</kbd> to close</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSearchDropdownOpen(false)}
                        className="font-bold text-blue-600 hover:underline"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Dark Mode Toggle */}
              <ThemeToggle />

              {/* Plan Badge */}
              <div
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold shadow-sm shrink-0 ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <span>🔒</span>
                <span>{tenant?.plan || 'DEMO'}</span>
              </div>

              {/* Profile Pill & Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border shadow-sm transition ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {userInitials}
                  </div>
                  <span className={`hidden sm:inline-block text-xs font-bold max-w-[120px] truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {user?.fullName || 'Administrator'}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {profileDropdownOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-64 rounded-xl shadow-xl border py-2 z-50 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="px-4 py-2 border-b border-slate-100/10">
                      <p className="text-xs font-bold">{user?.fullName || 'Administrator'}</p>
                      <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {user?.role || 'SCHOOL_ADMIN'}
                      </span>
                    </div>

                    <div className="px-4 py-2.5 border-b border-slate-100/10 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold">Test Mode</p>
                        <p className="text-[10px] text-slate-400">Override limits for testing</p>
                      </div>
                      <button
                        onClick={() => setTestMode(!testMode)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          testMode ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            testMode ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('settings');
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-500/10"
                    >
                      ⚙️ School Settings
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('subscription');
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-500/10 flex items-center justify-between"
                    >
                      <span>💳 Subscription Billing</span>
                      {tenant?.subscription?.status === 'expiring_soon' && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Due Soon
                        </span>
                      )}
                      {tenant?.subscription?.status === 'expired' && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          Overdue
                        </span>
                      )}
                    </button>

                    <div className="border-t border-slate-100/10 my-1" />

                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10"
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* TOAST / NOTICE BANNER */}
          {subscriptionToast && (
            <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm border ${
              subscriptionToast.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : subscriptionToast.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}>
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                <span>{subscriptionToast.type === 'success' ? '🎉' : subscriptionToast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
                <span>{subscriptionToast.message}</span>
              </div>
              <button
                onClick={() => setSubscriptionToast(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* SUBSCRIPTION DUE WARNING PROMPT BANNER (<= 7 DAYS) */}
          {tenant?.subscription?.isExpiringSoon && !bannerDismissed && (
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400/60 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 text-2xl font-bold shadow-inner">
                  ⏳
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-amber-950">
                      Subscription Renewal Due in {tenant.subscription.daysRemaining} Day{tenant.subscription.daysRemaining === 1 ? '' : 's'}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-300 uppercase tracking-wider">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-amber-900/90 mt-1">
                    Your school's <strong>{tenant.plan || 'School'} Plan</strong> subscription will expire on{' '}
                    <strong>
                      {tenant.subscription.currentPeriodEnd
                        ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : 'soon'}
                    </strong>
                    . Renew today to keep your student report cards, fees collection, and parent portal uninterrupted.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => setActiveTab('subscription')}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                >
                  <span>💳 Renew / Upgrade Now</span>
                </button>
                <button
                  onClick={() => setBannerDismissed(true)}
                  className="px-3 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 text-xs font-semibold border border-amber-300 transition"
                  title="Dismiss notice for this session"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Alert if no academic year exists */}
              {!stats?.activeYear && availableYears.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📅</span>
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">Set Up Your Academic Year</h4>
                      <p className="text-xs text-amber-700">No active academic session found. Create an academic year to manage terms, timetable, attendance, and student billing.</p>
                    </div>
                  </div>
                  {can('academic_years', 'create') && (
                      <button
                      onClick={openAddYearModal}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-sm transition whitespace-nowrap self-start sm:self-auto"
                    >
                      + Create Academic Year
                    </button>
                  )}
                </div>
              )}

              {/* FILTER DASHBOARD DATA CARD (MATCHING SCREENSHOT) */}
              <div
                className={`rounded-2xl border shadow-sm p-4 sm:p-5 transition-colors ${
                  darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b gap-2 ${
                  darkMode ? 'border-slate-700' : 'border-slate-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    </div>
                    <h3 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      Filter Dashboard Data
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    Filters applied automatically on change
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Academic Year Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`block text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Academic Year
                      </label>
                      {can('academic_years', 'create') && (
                          <button
                          type="button"
                          onClick={openAddYearModal}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                          title="Configure new academic year"
                        >
                          + Add Year
                        </button>
                      )}
                    </div>
                    <select
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition ${
                        darkMode
                          ? 'bg-slate-900 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      {availableYears.length > 0 ? (
                        availableYears.map((ay) => (
                          <option key={ay.id} value={ay.year}>
                            {ay.year} {ay.status === 'Active' ? '(Active)' : ''}
                          </option>
                        ))
                      ) : stats?.activeYear ? (
                        <option value={stats.activeYear}>
                          {stats.activeYear} (Active)
                        </option>
                      ) : (
                        <option value="">
                          No Academic Year Created
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Term Dropdown */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      Term
                    </label>
                    <select
                      value={selectedTerm}
                      onChange={(e) => handleTermChange(e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition ${
                        darkMode
                          ? 'bg-slate-900 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <option value="All Terms">All Terms</option>
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                  </div>

                  {/* Date Picker */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      Date (for attendance)
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition ${
                        darkMode
                          ? 'bg-slate-900 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Footnote */}
                <div className={`mt-4 pt-3 border-t flex items-start gap-2 text-xs text-slate-500 ${
                  darkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'
                }`}>
                  <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    i
                  </div>
                  <p>
                    <span className={`font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Academic Year & Term</span> filter attendance and invoices.{' '}
                    <span className={`font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Total Students</span> and{' '}
                    <span className={`font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Active Subjects</span> show current totals.{' '}
                    <span className={`font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Average Attendance</span> is calculated across selected period.
                  </p>
                </div>
              </div>

              {/* 4 KPI STAT CARDS (MATCHING SCREENSHOT) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. TOTAL STUDENTS */}
                <div
                  className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-colors ${
                    darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      TOTAL STUDENTS
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <StudentsIcon className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={`text-3xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {kpis?.totalStudents ?? stats?.studentCount ?? 0}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      +{kpis?.totalStudents ?? stats?.studentCount ?? 0} enrolled
                    </span>
                    <span className="text-[11px] text-slate-400">across all classes</span>
                  </div>
                </div>

                {/* 2. ACTIVE SUBJECTS */}
                <div
                  className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-colors ${
                    darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      ACTIVE SUBJECTS
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <SubjectIcon className="w-5 h-5 text-emerald-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={`text-3xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {kpis?.activeSubjects ?? stats?.subjectCount ?? 0}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {kpis?.activeSubjects ?? stats?.subjectCount ?? 0} active
                    </span>
                    <span className="text-[11px] text-slate-400">taught this term</span>
                  </div>
                </div>

                {/* 3. AVERAGE ATTENDANCE */}
                <div
                  className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-colors ${
                    darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      AVERAGE ATTENDANCE
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <AttendanceIcon className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={`text-3xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {kpis?.averageAttendance ?? '0.0%'}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      0 recorded
                    </span>
                    <span className="text-[11px] text-slate-400">for selected period</span>
                  </div>
                </div>

                {/* 4. TOTAL INVOICES */}
                <div
                  className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-colors ${
                    darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      TOTAL INVOICES
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <InvoicesIcon className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={`text-3xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {kpis?.totalInvoices ?? (quickInsights?.invoicesCount ?? 0)}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      {quickInsights?.unpaidInvoices ?? 0} unpaid
                    </span>
                    <span className="text-[11px] text-slate-400">generated this term</span>
                  </div>
                </div>
              </div>

              {/* 3 SVG CHARTS ROW (MATCHING SCREENSHOT) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* CHART 1: Payment Status by Class */}
                <div
                  className={`p-5 rounded-2xl border shadow-sm transition-colors ${
                    darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      Payment Status by Class
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                        <span>Paid Students</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                        <span>Unpaid Students</span>
                      </div>
                    </div>
                  </div>
                  {renderPaymentStatusChart()}
                </div>

                {/* CHART 2: Attendance Trend */}
                <div
                  className={`p-5 rounded-2xl border shadow-sm transition-colors ${
                    darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      Attendance Trend
                    </h3>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {selectedTerm} · {selectedYear || stats?.activeYear || 'No Academic Year'}
                    </span>
                  </div>
                  {renderAttendanceTrendChart()}
                </div>

                {/* CHART 3: Students by Class */}
                <div
                  className={`p-5 rounded-2xl border shadow-sm transition-colors ${
                    darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      Students by Class
                    </h3>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>
                      all years
                    </span>
                  </div>
                  {renderStudentsByClassChart()}
                </div>
              </div>

              {/* QUICK INSIGHTS CARD (MATCHING SCREENSHOT) */}
              <div
                className={`p-5 rounded-2xl border shadow-sm transition-colors ${
                  darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                    ⚡
                  </div>
                  <h3 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    Quick Insights
                  </h3>
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x ${
                  darkMode ? 'divide-slate-700' : 'divide-slate-100'
                }`}>
                  {/* Block 1: Invoices */}
                  <div className="pt-2 sm:pt-0 sm:px-4 first:pl-0">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      INVOICES
                    </div>
                    <div className={`text-2xl sm:text-3xl font-extrabold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {quickInsights?.invoicesCount ?? 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">
                      <span className="text-emerald-600 font-semibold">{quickInsights?.paidInvoices ?? 0} paid</span>
                      {' · '}
                      <span className="text-amber-600 font-semibold">{quickInsights?.partialInvoices ?? 0} partial</span>
                      {' · '}
                      <span className="text-red-500 font-semibold">{quickInsights?.unpaidInvoices ?? 0} unpaid</span>
                    </div>
                  </div>

                  {/* Block 2: Total Billed */}
                  <div className="pt-3 sm:pt-0 sm:px-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      TOTAL BILLED
                    </div>
                    <div className={`text-2xl sm:text-3xl font-extrabold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {tenant?.currency || 'GHS'} {(quickInsights?.totalBilled || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">
                      {quickInsights?.paymentsCount || 0} payments recorded
                    </div>
                  </div>

                  {/* Block 3: Collected */}
                  <div className="pt-3 sm:pt-0 sm:px-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      COLLECTED
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1">
                      {tenant?.currency || 'GHS'} {(quickInsights?.collectedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {quickInsights?.collectedPercentage || 0}% collected
                      </span>
                    </div>
                  </div>

                  {/* Block 4: Outstanding */}
                  <div className="pt-3 sm:pt-0 sm:px-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      OUTSTANDING
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-red-600 mt-1">
                      {tenant?.currency || 'GHS'} {(quickInsights?.outstandingAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                        {(quickInsights?.totalBilled || 0) > 0 ? (quickInsights?.outstandingPercentage ?? 0) : 0}% outstanding
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ENROLLED STUDENTS TABLE PREVIEW */}
              <div
                className={`p-6 rounded-2xl border shadow-sm transition-colors ${
                  darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      Enrolled Students
                    </h2>
                    <p className="text-xs text-slate-500">Recent admissions registered in {tenant?.name}.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {can('students', 'create') && (
                        <button
                        onClick={() => setShowEnrollModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5"
                      >
                        <span>➕</span> Enroll Student
                      </button>
                    )}
                    {can('students') && (
                        <button
                          onClick={() => setActiveTab('students')}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          View All Students →
                        </button>
                    )}
                  </div>
                </div>

                {students.length === 0 ? (
                  <div className={`text-center py-10 border border-dashed rounded-xl ${
                    darkMode ? 'border-slate-700' : 'border-slate-200'
                  }`}>
                    <span className="text-3xl">📝</span>
                    <p className={`text-sm font-semibold mt-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      No students enrolled yet
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Enroll your first student or import data from your Google Sheet.</p>
                    {can('students', 'create') && (
                        <button
                        onClick={() => setShowEnrollModal(true)}
                        className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        Enroll First Student
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className={`uppercase border-y ${
                        darkMode ? 'bg-slate-900/60 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <tr>
                          <th className="py-2.5 px-3">Student ID</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Gender</th>
                          <th className="py-2.5 px-3">Guardian</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${darkMode ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
                        {students.slice(0, 5).map((s) => (
                          <tr key={s.id} className={darkMode ? 'hover:bg-slate-750' : 'hover:bg-slate-50/50'}>
                            <td className="py-2.5 px-3 font-mono font-semibold text-blue-500">{s.studentId}</td>
                            <td className={`py-2.5 px-3 font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                              {s.firstName} {s.lastName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">{s.gender || '—'}</td>
                            <td className="py-2.5 px-3 text-slate-400">{s.guardianName || '—'}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STUDENTS DIRECTORY */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Students Directory</h1>
                  <p className="text-sm text-slate-500">Manage admissions, guardian records, and class assignments.</p>
                </div>
                <div className="flex items-center gap-3">
                  {can('students', 'create') && (
                      <button
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 shadow-sm transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Import Students
                      </button>
                  )}
                  {can('students', 'create') && (
                      <button
                        onClick={() => setShowEnrollModal(true)}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition flex items-center gap-2 self-start"
                      >
                        <span>➕</span> Enroll Student
                      </button>
                  )}
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Search by student name, ID, or guardian..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Showing {filteredStudents.length} of {students.length}
                </span>
              </div>

              {/* Students Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Student ID</th>
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Gender</th>
                        <th className="py-3 px-4">Guardian Name & Contact</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                            {students.length === 0 ? 'No students enrolled yet.' : 'No students match your search.'}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-mono font-semibold text-blue-600">{s.studentId}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{s.firstName} {s.lastName}</td>
                            <td className="py-3 px-4 text-slate-600">{s.gender || '—'}</td>
                            <td className="py-3 px-4">
                              <div className="text-xs font-semibold text-slate-800">{s.guardianName || '—'}</div>
                              <div className="text-[11px] text-slate-500">{s.guardianPhone || ''}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLASSES & SUBJECTS */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">📚 Class List</h1>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {classesList.length} {classesList.length === 1 ? 'Class' : 'Classes'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Manage classroom rosters, student capacity, and teacher allocations.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
                  >
                    Sync from Sheets
                  </button>
                  {can('classes', 'create') && (
                      <button
                      onClick={openAddClassModal}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center gap-1.5"
                    >
                      <span>+</span> Add Class
                    </button>
                  )}
                </div>
              </div>

              {/* Notice Banner */}
              {classNotice && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium flex items-center justify-between shadow-sm">
                  <span>{classNotice}</span>
                  <button
                    onClick={() => setClassNotice('')}
                    className="text-blue-500 hover:text-blue-800 font-bold ml-4"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Stats & Search Toolbar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Classes</span>
                    <span className="text-2xl font-extrabold text-slate-900">{classesList.length}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                    🏫
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Students</span>
                    <span className="text-2xl font-extrabold text-blue-600">
                      {classesList.reduce((sum, c) => sum + (c._count?.students || 0), 0)}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                    🎓
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Assigned Teachers</span>
                    <span className="text-2xl font-extrabold text-indigo-600">
                      {classesList.filter((c) => !!c.classTeacher).length}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                    👥
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                  <input
                    type="text"
                    placeholder="Search classes by name or teacher..."
                    value={classSearchQuery}
                    onChange={(e) => setClassSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {classSearchQuery && (
                  <button
                    onClick={() => setClassSearchQuery('')}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1"
                  >
                    Clear Search
                  </button>
                )}
              </div>

              {/* Classes List / Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {filteredClasses.length} {filteredClasses.length === 1 ? 'Classroom Found' : 'Classrooms Found'}
                  </span>
                  <button
                    onClick={fetchClasses}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {classLoading ? 'Refreshing...' : '↻ Refresh'}
                  </button>
                </div>

                {classLoading && classesList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    <div className="inline-block animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                    <p>Loading classes...</p>
                  </div>
                ) : filteredClasses.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-3">
                    <p className="text-base font-semibold text-slate-700">No classes found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {classSearchQuery
                        ? 'No classes match your current search query. Try searching for a different keyword.'
                        : 'No classroom rosters have been created yet. Add your first class to get started.'}
                    </p>
                    {!classSearchQuery && can('classes', 'create') && (
                      <button
                        onClick={openAddClassModal}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
                      >
                        + Add First Class
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredClasses.map((c) => {
                      const studentCount = c._count?.students ?? 0;
                      const hasStudents = studentCount > 0;
                      return (
                        <div
                          key={c.id}
                          className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Student Count Badge (Matching GAS Classes.html .student-count) */}
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 font-bold flex flex-col items-center justify-center border border-blue-100 shrink-0">
                              <span className="text-base leading-none">{studentCount}</span>
                              <span className="text-[9px] font-semibold uppercase text-blue-500 tracking-tight">
                                {studentCount === 1 ? 'Pupil' : 'Pupils'}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-base truncate">{c.name}</h4>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                <span>
                                  Class Teacher:{' '}
                                  <strong className="text-slate-700">
                                    {c.classTeacher?.fullName || 'Not assigned'}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {can('classes', 'edit') && (
                                <button
                                onClick={() => openEditClassModal(c)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition flex items-center gap-1"
                                title="Edit class"
                              >
                                <span>✏️</span> Edit
                              </button>
                            )}
                            {can('classes', 'delete') && (
                                <button
                                onClick={() => openDeleteClassModal(c)}
                                disabled={hasStudents}
                                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1 ${
                                  hasStudents
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                    : 'border border-red-200 text-red-600 hover:bg-red-50'
                                }`}
                                title={
                                  hasStudents
                                    ? 'Move or remove students before deleting this class'
                                    : 'Delete class'
                                }
                              >
                                <span>🗑️</span> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Secondary Curriculum Subjects sync reminder */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Curriculum Subjects & Allocations</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sync academic subjects assigned to teachers for report sheets and grade generation.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('migration')}
                  className="px-4 py-2 rounded-xl border border-dashed border-purple-400 text-purple-600 text-xs font-bold hover:bg-purple-50 transition shrink-0"
                >
                  Sync Subjects from Google Sheets
                </button>
              </div>

              {/* ADD / EDIT CLASS MODAL */}
              {showClassModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">
                        {editingClass ? 'Edit Class' : 'Add New Class'}
                      </h3>
                      <button
                        onClick={() => setShowClassModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <form onSubmit={handleClassFormSubmit}>
                      <div className="px-6 py-5 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                            Class Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={classForm.name}
                            onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Basic 7 or JHS 1"
                          />
                        </div>

                        {editingClass && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Enrolled Students
                            </label>
                            <input
                              type="text"
                              readOnly
                              disabled
                              value={`${editingClass._count?.students ?? 0} students enrolled`}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              This value is automatically calculated based on enrolled students.
                            </p>
                          </div>
                        )}

                        {classFormError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {classFormError}
                          </p>
                        )}
                      </div>
                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowClassModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={classFormLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {classFormLoading
                            ? editingClass ? 'Updating...' : 'Saving...'
                            : editingClass ? 'Update Class' : 'Save Class'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE CONFIRMATION MODAL */}
              {showDeleteClassModal && deletingClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>⚠️</span> Delete Class
                      </h3>
                      <button
                        onClick={() => setShowDeleteClassModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5">
                      {(deletingClass._count?.students ?? 0) > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-red-600 font-medium">
                            Cannot delete class &quot;{deletingClass.name}&quot;.
                          </p>
                          <p className="text-xs text-slate-500">
                            There are currently {deletingClass._count?.students} student(s) enrolled in this class. Move or remove students before deleting this class.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600 leading-relaxed">
                          Are you sure you want to delete <strong className="text-slate-900">{deletingClass.name}</strong>? This action cannot be undone.
                        </p>
                      )}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowDeleteClassModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      {(deletingClass._count?.students ?? 0) === 0 && (
                        <button
                          type="button"
                          onClick={handleDeleteClass}
                          disabled={deleteClassLoading}
                          className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition disabled:opacity-50"
                        >
                          {deleteClassLoading ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BILLING & MOMO */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Fee Billing & Payments</h1>
                  <p className="text-sm text-slate-500">
                    Manage student fee items and grade billing categories in {tenant?.currency || 'GHS'}.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                  >
                    Manage SaaS Plan
                  </button>
                </div>
              </div>

              {/* Sub-tab Navigation */}
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                {can('billing_items') && (
                    <button
                      onClick={() => setBillingSubTab('items')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        billingSubTab === 'items'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>🏷️</span>
                      <span>Fee Items (Billings)</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${billingSubTab === 'items' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {billingItems.length}
                      </span>
                    </button>
                )}

                {can('billing_categories') && (
                    <button
                      onClick={() => setBillingSubTab('categories')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        billingSubTab === 'categories'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>📁</span>
                      <span>Billing Categories</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${billingSubTab === 'categories' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {billingCategories.length}
                      </span>
                    </button>
                )}
              </div>

              {/* SUB-TAB 1: BILLING ITEMS */}
              {billingSubTab === 'items' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Fee Items Directory</h2>
                      <p className="text-xs text-slate-500">
                        Individual billable charges (e.g. Tuition Fee, Bed User Fee, Sports Fee, PTA).
                      </p>
                    </div>
                    {can('billing_items', 'create') && (
                        <button
                          onClick={() => setShowCreateItemModal(true)}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5"
                        >
                          <span>➕</span> Add Fee Item
                        </button>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Billing ID</th>
                            <th className="py-3 px-4">Item Name</th>
                            <th className="py-3 px-4">Default Amount</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {billingItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-10 text-center text-slate-500">
                                <p className="text-sm font-semibold text-slate-700">No fee items created yet.</p>
                                <p className="text-xs text-slate-400 mt-1">Add items like Tuition, Bed User Fee, or Sports Fee.</p>
                                {can('billing_items', 'create') && (
                                    <button
                                      onClick={() => setShowCreateItemModal(true)}
                                      className="mt-3 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                    >
                                      + Create First Fee Item
                                    </button>
                                )}
                              </td>
                            </tr>
                          ) : (
                            billingItems.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-bold text-blue-600">{item.billingId}</td>
                                <td className="py-3 px-4 font-bold text-slate-900">{item.item}</td>
                                <td className="py-3 px-4 font-extrabold text-slate-800">
                                  {tenant?.currency || 'GHS'} {Number(item.amount).toFixed(2)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500">{item.description || '—'}</td>
                                <td className="py-3 px-4 text-right">
                                  {can('billing_items', 'delete') && (
                                      <button
                                        onClick={() => handleDeleteBillingItem(item.id)}
                                        className="p-1 text-red-500 hover:text-red-700 text-xs font-bold"
                                        title="Delete item"
                                      >
                                        🗑️
                                      </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: BILLING CATEGORIES */}
              {billingSubTab === 'categories' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Billing Category Packages</h2>
                      <p className="text-xs text-slate-500">
                        Bundled fees assigned by grade (Primary, JHS, Nursery) per academic year & term.
                      </p>
                    </div>
                    {can('billing_categories', 'create') && (
                        <button
                          onClick={() => {
                            setShowCreateCategoryModal(true);
                            setSelectedItemNames([]);
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5"
                        >
                          <span>➕</span> Create Billing Category
                        </button>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Category ID</th>
                            <th className="py-3 px-4">Academic Year</th>
                            <th className="py-3 px-4">Term</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Included Fee Items</th>
                            <th className="py-3 px-4">Total Amount</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {billingCategories.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-slate-500">
                                <p className="text-sm font-semibold text-slate-700">No billing categories configured yet.</p>
                                <p className="text-xs text-slate-400 mt-1">Group fee items for Primary, JHS, Nursery, or Secondary.</p>
                                {can('billing_categories', 'create') && (
                                    <button
                                      onClick={() => {
                                        setShowCreateCategoryModal(true);
                                        setSelectedItemNames([]);
                                      }}
                                      className="mt-3 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                    >
                                      + Create First Category
                                    </button>
                                )}
                              </td>
                            </tr>
                          ) : (
                            billingCategories.map((cat) => (
                              <tr key={cat.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-bold text-blue-600">{cat.categoryId || '—'}</td>
                                <td className="py-3 px-4 font-semibold text-slate-800">{cat.academicYear || stats?.activeYear || '—'}</td>
                                <td className="py-3 px-4 text-slate-600">{cat.term || 'Term 1'}</td>
                                <td className="py-3 px-4">
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {cat.name}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {cat.items ? (
                                      cat.items.split(',').map((it, idx) => (
                                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                                          {it.trim()}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">All standard items</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-extrabold text-emerald-600 text-sm">
                                  {tenant?.currency || 'GHS'} {Number(cat.totalAmount).toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {can('billing_categories', 'delete') && (
                                      <button
                                        onClick={() => handleDeleteBillingCategory(cat.id)}
                                        className="p-1 text-red-500 hover:text-red-700 text-xs font-bold"
                                        title="Delete category"
                                      >
                                        🗑️
                                      </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SHEETS MIGRATION */}
          {activeTab === 'migration' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">1-Click Google Sheets Migration</h1>
                <p className="text-sm text-slate-500">
                  Effortlessly import all your existing students, classes, subjects, and fees from Google Sheets into this SaaS platform.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
                  <p className="font-bold text-sm">Two Easy Ways to Migrate Your Google Sheet:</p>
                  <div className="space-y-1">
                    <p><strong>Option A (Easiest - Directly from Google Sheets):</strong></p>
                    <p>Open your Google Spreadsheet, click the new top menu <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-blue-200">🚀 SaaS Migration</span> → <span className="font-semibold">Export Data for SaaS</span>, and click <strong>&quot;Copy to Clipboard&quot;</strong> or <strong>&quot;Download File&quot;</strong>.</p>
                  </div>
                  <div className="space-y-1 pt-1 border-t border-blue-200/60">
                    <p><strong>Option B (From Apps Script Editor):</strong></p>
                    <p>Run <code className="font-mono bg-white px-1 py-0.5 rounded font-bold">exportSaaSMigrationPayload()</code>. It automatically saves a full file named <code className="font-mono bg-white px-1 py-0.5 rounded">sms_saas_migration_data.json</code> into your <strong>Google Drive</strong> and logs the link in the execution output!</p>
                  </div>
                </div>

                <form onSubmit={handleMigration} className="space-y-4">
                  {/* File Upload Option */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Upload Migration File (.json)
                    </label>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            if (content) setMigrationPayload(content);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Or Paste JSON Payload Directly
                    </label>
                    <textarea
                      rows={8}
                      value={migrationPayload}
                      onChange={(e) => setMigrationPayload(e.target.value)}
                      placeholder='Paste JSON exported from your Google Sheet here... e.g. { "students": [...], "classes": [...] }'
                      className="w-full px-4 py-3 font-mono text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {migrationResult && (
                    <div
                      className={`p-3 rounded-xl text-xs font-semibold ${
                        migrationResult.startsWith('Error')
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {migrationResult}
                    </div>
                  )}

                  {can('migration', 'create') && (
                      <button
                        type="submit"
                        disabled={migrationLoading}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
                      >
                        {migrationLoading ? 'Migrating Database...' : 'Run Migration Now'}
                      </button>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">School Profile &amp; System Settings</h1>
                  <p className="text-sm text-slate-500">
                    Customise identity, grading score weights, system lists, automated backups, and tenant audit trail for {tenant?.name || 'your institution'}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchSettings}
                    disabled={settingsLoading}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition flex items-center gap-1.5 disabled:opacity-50"
                    title="Reload settings"
                  >
                    <span>🔄</span> {settingsLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                  {can('settings', 'edit') && (
                      <button
                      onClick={handleDownloadBackup}
                      disabled={backupLoading}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span>📥</span> {backupLoading ? 'Exporting...' : 'Export Backup'}
                    </button>
                  )}
                </div>
              </div>

              {/* Notification Banner */}
              {settingsNotice && (
                <div
                  className={`p-4 rounded-xl text-sm flex items-center justify-between ${
                    settingsNotice.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{settingsNotice.type === 'success' ? '✅' : '⚠️'}</span>
                    <span className="font-medium">{settingsNotice.message}</span>
                  </div>
                  <button
                    onClick={() => setSettingsNotice(null)}
                    className="text-xs font-bold hover:underline opacity-70 hover:opacity-100"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Sub-Navigation Tabs */}
              <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
                <button
                  onClick={() => setSettingsActiveSubTab('profile')}
                  className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
                    settingsActiveSubTab === 'profile'
                      ? 'bg-white border-t-2 border-x border-slate-200 text-blue-600 shadow-sm -mb-px'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>🏫</span> School Profile &amp; Identity
                </button>
                <button
                  onClick={() => setSettingsActiveSubTab('grading')}
                  className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
                    settingsActiveSubTab === 'grading'
                      ? 'bg-white border-t-2 border-x border-slate-200 text-blue-600 shadow-sm -mb-px'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>📊</span> Grading &amp; Academic Weights
                </button>
                <button
                  onClick={() => setSettingsActiveSubTab('lists')}
                  className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
                    settingsActiveSubTab === 'lists'
                      ? 'bg-white border-t-2 border-x border-slate-200 text-blue-600 shadow-sm -mb-px'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>📑</span> System Lists &amp; Categories
                </button>
                <button
                  onClick={() => setSettingsActiveSubTab('backup')}
                  className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
                    settingsActiveSubTab === 'backup'
                      ? 'bg-white border-t-2 border-x border-slate-200 text-blue-600 shadow-sm -mb-px'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>💾</span> Data Backup &amp; Export
                </button>
                <button
                  onClick={() => setSettingsActiveSubTab('audit')}
                  className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
                    settingsActiveSubTab === 'audit'
                      ? 'bg-white border-t-2 border-x border-slate-200 text-blue-600 shadow-sm -mb-px'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>🛡️</span> Audit Logs &amp; Activity
                </button>
                <button
                  onClick={() => {
                    setSettingsActiveSubTab('gateways');
                    fetchGatewaySettings();
                  }}
                  className={`px-4 py-2.5 font-semibold text-xs rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
                    settingsActiveSubTab === 'gateways'
                      ? 'bg-white border-t-2 border-x border-slate-200 text-blue-600 shadow-sm -mb-px'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>💳</span> Payment Gateways
                </button>
              </div>

              {/* SUB-TAB 1: SCHOOL PROFILE & IDENTITY */}
              {settingsActiveSubTab === 'profile' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Form (2 cols) */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="mb-5 pb-4 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">School Identity Details</h2>
                        <p className="text-xs text-slate-500">
                          These details appear automatically across generated invoices, receipts, and terminal student reports.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Official School Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            placeholder="e.g. Achimota Senior High School"
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Short Name / Alias
                          </label>
                          <input
                            type="text"
                            value={profileForm.alias}
                            onChange={(e) => setProfileForm({ ...profileForm, alias: e.target.value })}
                            placeholder="e.g. MOTOWN"
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Official Email Address
                          </label>
                          <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                            placeholder="admin@school.edu.gh"
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Contact Phone Number
                          </label>
                          <input
                            type="text"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            placeholder="+233 24 123 4567"
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Default Billing Currency <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={profileForm.currency}
                            onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="GHS">GHS - Ghanaian Cedi (GH₵)</option>
                            <option value="USD">USD - US Dollar ($)</option>
                            <option value="GBP">GBP - British Pound (£)</option>
                            <option value="EUR">EUR - Euro (€)</option>
                            <option value="NGN">NGN - Nigerian Naira (₦)</option>
                            <option value="KES">KES - Kenyan Shilling (KSh)</option>
                            <option value="ZAR">ZAR - South African Rand (R)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            School Logo
                          </label>
                          <input
                            type="file"
                            ref={profileLogoInputRef}
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleProfileLogoUpload(file);
                              e.target.value = '';
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => profileLogoInputRef.current?.click()}
                              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition flex items-center gap-1.5 shrink-0"
                            >
                              <span>📁</span> Upload from Device
                            </button>
                            {profileForm.logoUrl && (
                              <button
                                type="button"
                                onClick={() => setProfileForm({ ...profileForm, logoUrl: '' })}
                                className="px-2.5 py-1.5 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold transition"
                                title="Remove current logo"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="mt-1.5">
                            <input
                              type="text"
                              value={profileForm.logoUrl.startsWith('data:') ? '[Uploaded Image File from Device]' : profileForm.logoUrl}
                              onChange={(e) => {
                                if (!e.target.value.startsWith('[')) {
                                  setProfileForm({ ...profileForm, logoUrl: e.target.value });
                                }
                              }}
                              placeholder="Or paste an image URL..."
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-600"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Campus Address / Postal Location
                        </label>
                        <textarea
                          rows={2}
                          value={profileForm.address}
                          onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                          placeholder="P.O. Box 11, Achimota, Accra, Ghana"
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="pt-2 flex justify-end">
                        {can('settings', 'edit') && (
                            <button
                              type="submit"
                              disabled={profileSaving}
                              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                            >
                              <span>💾</span> {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                            </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Right Column: Cards (1 col) */}
                  <div className="space-y-6">
                    {/* Live Preview Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                        Document Header Preview
                      </h3>
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex items-center gap-3">
                        {profileForm.logoUrl ? (
                          <img
                            src={profileForm.logoUrl}
                            alt="School Logo"
                            className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-1"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                            {profileForm.alias ? profileForm.alias.slice(0, 2).toUpperCase() : '🏫'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {profileForm.name || 'School Name'}
                          </p>
                          {profileForm.alias && (
                            <p className="text-[11px] font-semibold text-blue-600">{profileForm.alias}</p>
                          )}
                          <p className="text-[10px] text-slate-500 truncate">
                            {profileForm.address || 'Campus Address'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {profileForm.phone ? `Tel: ${profileForm.phone}` : ''}
                            {profileForm.email ? ` • ${profileForm.email}` : ''}
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 text-center">
                        Matches your printable receipt, invoice, and report card banners.
                      </p>
                    </div>

                    {/* Subdomain & Quota Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm divide-y divide-slate-100">
                      <div className="pb-3 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-600">Subdomain</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                          {tenant?.subdomain}.smsapp.com
                        </span>
                      </div>
                      <div className="py-3 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-600">Subscription Tier</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {tenant?.plan || 'DEMO'}
                          </span>
                          <button
                            onClick={() => setActiveTab('subscription')}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Manage / Upgrade ↗
                          </button>
                        </div>
                      </div>
                      <div className="py-3 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-600">Student Capacity</span>
                          <span className="font-bold text-slate-900">
                            {tenantSettings?.stats?.studentsCount ?? students.length} / {tenant?.studentLimit || 15}
                          </span>
                        </div>
                        {/* Capacity progress bar */}
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (tenantSettings?.stats?.studentsCount ?? students.length) >= (tenant?.studentLimit || 15)
                                ? 'bg-rose-500'
                                : (tenantSettings?.stats?.studentsCount ?? students.length) >= (tenant?.studentLimit || 15) * 0.8
                                ? 'bg-amber-500'
                                : 'bg-blue-600'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (((tenantSettings?.stats?.studentsCount ?? students.length) as number) /
                                    (tenant?.studentLimit || 15)) *
                                    100
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="pt-3 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-600">Tenant ID</span>
                        <span className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]" title={tenant?.id}>
                          {tenant?.id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: GRADING & ACADEMIC WEIGHTS */}
              {settingsActiveSubTab === 'grading' && (
                <div className="space-y-6">
                  {/* Grading Weights Configuration Form */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="mb-5 pb-4 border-b border-slate-100">
                      <h2 className="text-base font-bold text-slate-900">Assessment Score Percentages</h2>
                      <p className="text-xs text-slate-500">
                        In accordance with the School Management System standard, terminal performance calculations require Class Assessment and Examination weights to total exactly 100%.
                      </p>
                    </div>

                    <form onSubmit={handleSaveGradingWeights} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Class Assessment (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={gradingForm.classScore}
                            onChange={(e) => setGradingForm({ ...gradingForm, classScore: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">Continuous homework, tests &amp; projects</p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Examination Score (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={gradingForm.examScore}
                            onChange={(e) => setGradingForm({ ...gradingForm, examScore: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">End of term exam paper mark</p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Passing Mark Cutoff (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={gradingForm.passingMark}
                            onChange={(e) => setGradingForm({ ...gradingForm, passingMark: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">Minimum score required to pass</p>
                        </div>
                      </div>

                      {/* Live Validation Bar */}
                      <div className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border-slate-200">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              Number(gradingForm.classScore) + Number(gradingForm.examScore) === 100
                                ? 'bg-emerald-500'
                                : 'bg-rose-500 animate-pulse'
                            }`}
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              Total Score Weight:{' '}
                              <span
                                className={
                                  Number(gradingForm.classScore) + Number(gradingForm.examScore) === 100
                                    ? 'text-emerald-700 font-black'
                                    : 'text-rose-600 font-black'
                                }
                              >
                                {Number(gradingForm.classScore) + Number(gradingForm.examScore)}%
                              </span>{' '}
                              / 100%
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {Number(gradingForm.classScore) + Number(gradingForm.examScore) === 100
                                ? 'Valid distribution: Class Score (' +
                                  gradingForm.classScore +
                                  '%) + Exam Score (' +
                                  gradingForm.examScore +
                                  '%) = 100%'
                                : 'Class Score (' +
                                  gradingForm.classScore +
                                  '%) and Exam Score (' +
                                  gradingForm.examScore +
                                  '%) must equal 100%'}
                            </p>
                          </div>
                        </div>

                        {can('settings', 'edit') && (
                            <button
                              type="submit"
                              disabled={
                                gradingSaving ||
                                Number(gradingForm.classScore) + Number(gradingForm.examScore) !== 100
                              }
                              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 disabled:opacity-50 transition shadow-sm self-start sm:self-auto"
                            >
                              {gradingSaving ? 'Saving Weights...' : 'Save Grading Weights'}
                            </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* System Parameters Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Academic &amp; System Parameters</h3>
                        <p className="text-xs text-slate-500">
                          Tenant-isolated operational flags, default terms, and academic year settings.
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Parameter Name</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Configured Value</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tenantSettings?.parameters && tenantSettings.parameters.length > 0 ? (
                            tenantSettings.parameters.map((p) => (
                              <tr key={p.param} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-mono font-bold text-slate-800">{p.param}</td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    {p.category || 'General'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-medium text-slate-700 max-w-xs truncate">
                                  {p.value}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => openParamModal(p)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] transition"
                                  >
                                    ✏️ Edit
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-400">
                                No custom parameters recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: SYSTEM LISTS & CATEGORIES */}
              {settingsActiveSubTab === 'lists' && (
                <div className="space-y-6">
                  {/* Fee Categories Section */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Fee Categories List</h2>
                        <p className="text-xs text-slate-500">
                          Standard categories available during invoice generation and bill creation.
                        </p>
                      </div>
                      {can('settings', 'edit') && (
                          <button
                          onClick={() => openAddListItemModal('categories')}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition flex items-center gap-1.5 self-start"
                        >
                          <span>➕</span> Add Category
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {tenantSettings?.lists.categories && tenantSettings.lists.categories.length > 0 ? (
                        tenantSettings.lists.categories.map((cat) => (
                          <div
                            key={cat}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-slate-800 text-xs font-medium transition"
                          >
                            <span>🏷️ {cat}</span>
                            <div className="flex items-center gap-1 border-l border-slate-300 pl-1.5">
                              {can('settings', 'edit') && (
                                  <button
                                  onClick={() => openEditListItemModal('categories', cat)}
                                  className="text-slate-500 hover:text-blue-600 text-[10px]"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                              )}
                              {can('settings', 'edit') && (
                                  <button
                                  onClick={() => handleDeleteListItem('categories', cat)}
                                  className="text-slate-500 hover:text-rose-600 text-[10px]"
                                  title="Delete"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">No fee categories configured.</p>
                      )}
                    </div>
                  </div>

                  {/* Payment Methods Section */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Accepted Payment Methods</h2>
                        <p className="text-xs text-slate-500">
                          Channels supported when recording student fee payments and bursar receipts.
                        </p>
                      </div>
                      {can('settings', 'edit') && (
                          <button
                          onClick={() => openAddListItemModal('methods')}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition flex items-center gap-1.5 self-start"
                        >
                          <span>➕</span> Add Payment Method
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {tenantSettings?.lists.methods && tenantSettings.lists.methods.length > 0 ? (
                        tenantSettings.lists.methods.map((method) => (
                          <div
                            key={method}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-xs font-medium transition"
                          >
                            <span>💳 {method}</span>
                            <div className="flex items-center gap-1 border-l border-emerald-300 pl-1.5">
                              {can('settings', 'edit') && (
                                  <button
                                  onClick={() => openEditListItemModal('methods', method)}
                                  className="text-emerald-600 hover:text-blue-600 text-[10px]"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                              )}
                              {can('settings', 'edit') && (
                                  <button
                                  onClick={() => handleDeleteListItem('methods', method)}
                                  className="text-emerald-600 hover:text-rose-600 text-[10px]"
                                  title="Delete"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">No payment methods configured.</p>
                      )}
                    </div>
                  </div>

                  {/* Invoice Status Reference */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="mb-4 pb-3 border-b border-slate-100">
                      <h2 className="text-base font-bold text-slate-900">Standard Billing Lifecycle Statuses</h2>
                      <p className="text-xs text-slate-500">
                        System-level statuses assigned automatically to student invoices and fee balances.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                        <span className="block text-xs font-black text-emerald-700">PAID</span>
                        <span className="text-[10px] text-emerald-600">Zero remaining balance</span>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                        <span className="block text-xs font-black text-blue-700">PARTIAL</span>
                        <span className="text-[10px] text-blue-600">Partial payment received</span>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                        <span className="block text-xs font-black text-amber-700">UNPAID</span>
                        <span className="text-[10px] text-amber-600">No payment logged</span>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                        <span className="block text-xs font-black text-rose-700">OVERDUE</span>
                        <span className="text-[10px] text-rose-600">Passed payment deadline</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <span className="block text-xs font-black text-slate-600">CANCELLED</span>
                        <span className="text-[10px] text-slate-500">Voided bill</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 4: DATA BACKUP & EXPORT */}
              {settingsActiveSubTab === 'backup' && (
                <div className="space-y-6">
                  {/* Backup Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Tenant Database Snapshot &amp; Export</h2>
                        <p className="text-xs text-slate-500">
                          Export a complete, self-contained JSON snapshot of all records belonging strictly to {tenant?.name || 'your institution'}.
                        </p>
                      </div>
                      {can('settings', 'edit') && (
                          <button
                          onClick={handleDownloadBackup}
                          disabled={backupLoading}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition flex items-center gap-2 disabled:opacity-50 self-start sm:self-auto"
                        >
                          <span>📥</span> {backupLoading ? 'Generating Snapshot...' : 'Download JSON Backup'}
                        </button>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-lg font-black text-slate-900">
                          {tenantSettings?.stats?.studentsCount ?? students.length}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Students</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-lg font-black text-slate-900">
                          {tenantSettings?.stats?.teachersCount ?? teachers.length}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Teachers</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-lg font-black text-slate-900">
                          {tenantSettings?.stats?.classesCount ?? classesList.length}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Classes</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-lg font-black text-slate-900">
                          {tenantSettings?.stats?.invoicesCount ?? invoicesList.length}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Invoices</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-lg font-black text-slate-900">
                          {tenantSettings?.stats?.paymentsCount ?? payments.length}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Payments</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-lg font-black text-slate-900">
                          {tenantSettings?.stats?.attendanceCount ?? 0}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Attendance</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-lg font-black text-slate-900">
                          {tenantSettings?.stats?.performanceCount ?? 0}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Performance</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
                      <p className="font-bold flex items-center gap-1.5">
                        <span>🔒</span> Tenant Data Security &amp; Isolation Assurance
                      </p>
                      <p className="leading-relaxed">
                        The downloaded file contains a structured JSON snapshot including all your school&apos;s academic, financial, attendance, and operational records. Passwords, user access tokens, and other sensitive system credentials are strictly omitted. Only data tagged with your unique Tenant ID (<code className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">{tenant?.id}</code>) is bundled.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 5: AUDIT LOGS & SECURITY */}
              {settingsActiveSubTab === 'audit' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Administrative Audit Trail</h2>
                      <p className="text-xs text-slate-500">
                        Chronological record of configuration modifications, grading changes, and exports for this tenant.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Date &amp; Time</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Module</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4">User</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tenantSettings?.auditLogs && tenantSettings.auditLogs.length > 0 ? (
                          tenantSettings.auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    log.action.includes('EXPORT')
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : log.action.includes('UPDATE')
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-700">{log.entity}</td>
                              <td className="py-3 px-4 text-slate-700 max-w-sm">{log.details}</td>
                              <td className="py-3 px-4 text-slate-500 text-[11px]">
                                {log.user?.fullName || log.user?.email || 'Admin'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No administrative audit events recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-TAB 6: PAYMENT GATEWAYS CONFIGURATION */}
              {settingsActiveSubTab === 'gateways' && (
                <div className="space-y-6">
                  {/* Gateways Notice */}
                  {gatewaysNotice && (
                    <div
                      className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold ${
                        gatewaysNotice.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <span>{gatewaysNotice.message}</span>
                      <button
                        onClick={() => setGatewaysNotice(null)}
                        className="text-xs font-bold hover:underline opacity-70 hover:opacity-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Header & Global Config Banner */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>💳</span> Online Payment Gateway Integration
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Configure live API credentials for Paystack, Flutterwave, and Stripe to accept online school fees, parent mobile money, and SaaS subscription auto-upgrades.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={fetchGatewaySettings}
                          disabled={gatewaysLoading}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <span>🔄</span> {gatewaysLoading ? 'Loading...' : 'Reload Config'}
                        </button>
                        {can('settings', 'edit') && (
                            <button
                            type="button"
                            onClick={handleSaveGatewaySettings}
                            disabled={gatewaysSaving}
                            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                          >
                            {gatewaysSaving ? <span className="animate-spin">⚙️</span> : <span>💾</span>}
                            <span>{gatewaysSaving ? 'Saving Settings...' : 'Save All Gateways'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Global Gateway Preferences */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Primary Default Gateway
                        </label>
                        <select
                          value={gatewaySettings.defaultGateway}
                          onChange={(e) =>
                            setGatewaySettings({
                              ...gatewaySettings,
                              defaultGateway: e.target.value as any,
                            })
                          }
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="paystack">Paystack (Recommended for Ghana MoMo &amp; Cards)</option>
                          <option value="flutterwave">Flutterwave (Recommended for Pan-African MoMo &amp; Cards)</option>
                          <option value="stripe">Stripe (Recommended for International Cards &amp; Apple Pay)</option>
                          <option value="sandbox">Sandbox (Internal Testing &amp; Instant Simulation)</option>
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Default payment provider preselected at checkout and paywall overlays.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Platform Settlement Currency
                        </label>
                        <select
                          value={gatewaySettings.currency}
                          onChange={(e) =>
                            setGatewaySettings({
                              ...gatewaySettings,
                              currency: e.target.value,
                            })
                          }
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="GHS">GHS — Ghanaian Cedi (GH₵)</option>
                          <option value="USD">USD — US Dollar ($)</option>
                          <option value="NGN">NGN — Nigerian Naira (₦)</option>
                          <option value="KES">KES — Kenyan Shilling (KSh)</option>
                          <option value="EUR">EUR — Euro (€)</option>
                          <option value="GBP">GBP — British Pound (£)</option>
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Default 3-letter ISO currency for online charges and billing invoices.
                        </p>
                      </div>
                    </div>

                    {/* Webhook Endpoint Assistant */}
                    <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <span>🔔</span> Unified Webhook Notification URL
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Paste this URL in your Paystack, Flutterwave, or Stripe dashboard under Webhooks for instant automated subscription activations:
                        </p>
                        <code className="inline-block mt-1 font-mono text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 break-all select-all">
                          {typeof window !== 'undefined' ? `${window.location.origin}/api/subscriptions/webhook` : 'https://your-domain.com/api/subscriptions/webhook'}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyWebhook}
                        className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition shrink-0 self-start sm:self-auto"
                      >
                        {copiedWebhook ? '✓ Copied URL!' : '📋 Copy URL'}
                      </button>
                    </div>
                  </div>

                  {/* Gateway Cards Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 1. PAYSTACK */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-black text-sm">
                              PS
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-slate-900">Paystack</h3>
                              <p className="text-[10px] text-slate-400">Ghana MoMo &amp; Cards</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={gatewaySettings.paystack.enabled}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  paystack: { ...gatewaySettings.paystack, enabled: e.target.checked },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>

                        <div className="mt-4 space-y-3.5">
                          {/* Mode Toggle */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-600">Mode</span>
                            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] font-bold">
                              <button
                                type="button"
                                onClick={() =>
                                  setGatewaySettings({
                                    ...gatewaySettings,
                                    paystack: { ...gatewaySettings.paystack, mode: 'test' },
                                  })
                                }
                                className={`px-2.5 py-1 rounded-md transition ${
                                  gatewaySettings.paystack.mode === 'test'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-500'
                                }`}
                              >
                                Test
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setGatewaySettings({
                                    ...gatewaySettings,
                                    paystack: { ...gatewaySettings.paystack, mode: 'live' },
                                  })
                                }
                                className={`px-2.5 py-1 rounded-md transition ${
                                  gatewaySettings.paystack.mode === 'live'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-500'
                                }`}
                              >
                                Live
                              </button>
                            </div>
                          </div>

                          {/* Public Key */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Public Key
                            </label>
                            <input
                              type="text"
                              value={gatewaySettings.paystack.publicKey}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  paystack: { ...gatewaySettings.paystack, publicKey: e.target.value },
                                })
                              }
                              placeholder="pk_test_... or pk_live_..."
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          {/* Secret Key */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Secret Key
                              </label>
                              {gatewaySettings.paystack.hasSecretKey && (
                                <span className="text-[10px] font-bold text-emerald-600">✓ Key Configured</span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={gatewaySettings.paystack.secretKey}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  paystack: { ...gatewaySettings.paystack, secretKey: e.target.value },
                                })
                              }
                              placeholder={
                                gatewaySettings.paystack.hasSecretKey
                                  ? '•••••••••••••••• (Leave blank to keep current)'
                                  : 'sk_test_... or sk_live_...'
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              Leave masked bullet value to retain your existing saved key.
                            </p>
                          </div>

                          {/* Supported Channels */}
                          <div className="pt-2">
                            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Enabled Channels
                            </span>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                                📱 Mobile Money (MTN, Telecel, AT)
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                                💳 Visa &amp; Mastercard
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. FLUTTERWAVE */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-black text-sm">
                              FL
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-slate-900">Flutterwave</h3>
                              <p className="text-[10px] text-slate-400">Pan-African MoMo &amp; Cards</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={gatewaySettings.flutterwave.enabled}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  flutterwave: { ...gatewaySettings.flutterwave, enabled: e.target.checked },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                          </label>
                        </div>

                        <div className="mt-4 space-y-3.5">
                          {/* Mode Toggle */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-600">Mode</span>
                            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] font-bold">
                              <button
                                type="button"
                                onClick={() =>
                                  setGatewaySettings({
                                    ...gatewaySettings,
                                    flutterwave: { ...gatewaySettings.flutterwave, mode: 'test' },
                                  })
                                }
                                className={`px-2.5 py-1 rounded-md transition ${
                                  gatewaySettings.flutterwave.mode === 'test'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-500'
                                }`}
                              >
                                Test
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setGatewaySettings({
                                    ...gatewaySettings,
                                    flutterwave: { ...gatewaySettings.flutterwave, mode: 'live' },
                                  })
                                }
                                className={`px-2.5 py-1 rounded-md transition ${
                                  gatewaySettings.flutterwave.mode === 'live'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-500'
                                }`}
                              >
                                Live
                              </button>
                            </div>
                          </div>

                          {/* Public Key */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Public Key
                            </label>
                            <input
                              type="text"
                              value={gatewaySettings.flutterwave.publicKey}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  flutterwave: { ...gatewaySettings.flutterwave, publicKey: e.target.value },
                                })
                              }
                              placeholder="FLWPUBK_TEST-... or FLWPUBK-..."
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          {/* Secret Key */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Secret Key
                              </label>
                              {gatewaySettings.flutterwave.hasSecretKey && (
                                <span className="text-[10px] font-bold text-amber-600">✓ Key Configured</span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={gatewaySettings.flutterwave.secretKey}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  flutterwave: { ...gatewaySettings.flutterwave, secretKey: e.target.value },
                                })
                              }
                              placeholder={
                                gatewaySettings.flutterwave.hasSecretKey
                                  ? '•••••••••••••••• (Leave blank to keep current)'
                                  : 'FLWSECK_TEST-... or FLWSECK-...'
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          {/* Encryption Key */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Encryption Key (Optional)
                            </label>
                            <input
                              type="text"
                              value={gatewaySettings.flutterwave.encryptionKey || ''}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  flutterwave: { ...gatewaySettings.flutterwave, encryptionKey: e.target.value },
                                })
                              }
                              placeholder="FLWSECK_TEST_... or hash"
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          {/* Channels */}
                          <div className="pt-2">
                            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Supported Channels
                            </span>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                                🇬🇭 Ghana MoMo
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                                🇳🇬 Bank Transfer &amp; USSD
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                                💳 Pan-African Debit Cards
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. STRIPE */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-black text-sm">
                              ST
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-slate-900">Stripe</h3>
                              <p className="text-[10px] text-slate-400">Global Cards &amp; Apple Pay</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={gatewaySettings.stripe.enabled}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  stripe: { ...gatewaySettings.stripe, enabled: e.target.checked },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        <div className="mt-4 space-y-3.5">
                          {/* Mode Toggle */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-600">Mode</span>
                            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] font-bold">
                              <button
                                type="button"
                                onClick={() =>
                                  setGatewaySettings({
                                    ...gatewaySettings,
                                    stripe: { ...gatewaySettings.stripe, mode: 'test' },
                                  })
                                }
                                className={`px-2.5 py-1 rounded-md transition ${
                                  gatewaySettings.stripe.mode === 'test'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-500'
                                }`}
                              >
                                Test
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setGatewaySettings({
                                    ...gatewaySettings,
                                    stripe: { ...gatewaySettings.stripe, mode: 'live' },
                                  })
                                }
                                className={`px-2.5 py-1 rounded-md transition ${
                                  gatewaySettings.stripe.mode === 'live'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-500'
                                }`}
                              >
                                Live
                              </button>
                            </div>
                          </div>

                          {/* Publishable Key */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Publishable Key
                            </label>
                            <input
                              type="text"
                              value={gatewaySettings.stripe.publicKey}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  stripe: { ...gatewaySettings.stripe, publicKey: e.target.value },
                                })
                              }
                              placeholder="pk_test_... or pk_live_..."
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          {/* Secret Key */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Secret Key
                              </label>
                              {gatewaySettings.stripe.hasSecretKey && (
                                <span className="text-[10px] font-bold text-indigo-600">✓ Key Configured</span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={gatewaySettings.stripe.secretKey}
                              onChange={(e) =>
                                setGatewaySettings({
                                  ...gatewaySettings,
                                  stripe: { ...gatewaySettings.stripe, secretKey: e.target.value },
                                })
                              }
                              placeholder={
                                gatewaySettings.stripe.hasSecretKey
                                  ? '•••••••••••••••• (Leave blank to keep current)'
                                  : 'sk_test_... or sk_live_...'
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          {/* Channels */}
                          <div className="pt-2">
                            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Supported Channels
                            </span>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                                💳 Global Visa, Mastercard, AMEX
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                                🍎 Apple Pay &amp; Google Pay
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Save Action */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Settings are instantly synchronized across all student invoice payment buttons and school plan checkout flows.
                    </p>
                    {can('settings', 'edit') && (
                        <button
                        type="button"
                        onClick={handleSaveGatewaySettings}
                        disabled={gatewaysSaving}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {gatewaysSaving ? <span className="animate-spin">⚙️</span> : <span>💾</span>}
                        <span>{gatewaysSaving ? 'Saving Configurations...' : 'Save Payment Gateways'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: TEACHERS */}
          {activeTab === 'teachers' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Teachers &amp; Faculty Directory</h1>
                  <p className="text-sm text-slate-500">Manage teaching staff, assigned classes, and academic year for {tenant?.name}.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition flex items-center gap-2"
                  >
                    <span>🔄</span> Import from Sheets
                  </button>
                  {can('teachers', 'create') && (
                      <button
                      onClick={openAddTeacherModal}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition flex items-center gap-2 self-start"
                    >
                      <span>➕</span> Add Teacher
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Search by name, ID, or class..."
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {teacherLoading ? 'Loading...' : `Showing ${filteredTeachers.length} of ${teachers.length}`}
                </span>
              </div>

              {/* Teachers Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {teacherLoading ? (
                  <div className="py-16 text-center text-slate-400 text-sm">Loading teachers...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Teacher ID</th>
                          <th className="py-3 px-4">First Name</th>
                          <th className="py-3 px-4">Last Name</th>
                          <th className="py-3 px-4">Class</th>
                          <th className="py-3 px-4">Academic Year</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTeachers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                              {teachers.length === 0 ? (
                                <div className="space-y-3">
                                  <div className="text-3xl">👨‍🏫</div>
                                  <p className="font-semibold text-slate-700">No teachers added yet.</p>
                                  <p className="text-xs text-slate-400">Click &ldquo;Add Teacher&rdquo; to get started, or import from Google Sheets.</p>
                                  {can('teachers', 'create') && (
                                      <button
                                      onClick={openAddTeacherModal}
                                      className="mt-1 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                    >
                                      + Add First Teacher
                                    </button>
                                  )}
                                </div>
                              ) : (
                                'No teachers match your search.'
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredTeachers.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-mono font-semibold text-blue-600">{t.teacherId}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">{t.firstName}</td>
                              <td className="py-3 px-4 text-slate-700">{t.lastName}</td>
                              <td className="py-3 px-4 text-slate-600">{t.className || '—'}</td>
                              <td className="py-3 px-4 text-slate-600">{t.academicYear || '—'}</td>
                              <td className="py-3 px-4 text-center">
                                {can('teachers', 'edit') && (
                                    <button
                                    onClick={() => openEditTeacherModal(t)}
                                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition text-base"
                                    title="Edit teacher"
                                  >
                                    ✏️
                                  </button>
                                )}
                                {can('teachers', 'delete') && (
                                    <button
                                    onClick={() => openDeleteTeacherModal(t)}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-base ml-1"
                                    title="Delete teacher"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ADD / EDIT TEACHER MODAL */}
              {showTeacherModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">
                        {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
                      </h3>
                      <button
                        onClick={() => setShowTeacherModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <form onSubmit={handleTeacherFormSubmit}>
                      <div className="px-6 py-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">First Name</label>
                            <input
                              type="text"
                              required
                              value={teacherForm.firstName}
                              onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g. John"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
                            <input
                              type="text"
                              required
                              value={teacherForm.lastName}
                              onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g. Mensah"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Assigned Class</label>
                            <input
                              type="text"
                              value={teacherForm.className}
                              onChange={(e) => setTeacherForm({ ...teacherForm, className: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g. Class 4"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Academic Year</label>
                            <input
                              type="text"
                              value={teacherForm.academicYear}
                              onChange={(e) => setTeacherForm({ ...teacherForm, academicYear: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={stats?.activeYear || ''}
                              title={stats?.activeYear ? '' : 'Create an academic year first'}
                            />
                          </div>
                        </div>
                        {teacherFormError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{teacherFormError}</p>
                        )}
                      </div>
                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowTeacherModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={teacherFormLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {teacherFormLoading
                            ? (editingTeacher ? 'Updating...' : 'Saving...')
                            : (editingTeacher ? 'Update Teacher' : 'Save Teacher')}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE CONFIRMATION MODAL */}
              {showDeleteTeacherModal && deletingTeacher && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">Delete Teacher</h3>
                      <button
                        onClick={() => setShowDeleteTeacherModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete teacher{' '}
                        <strong className="text-slate-900">{deletingTeacher.firstName} {deletingTeacher.lastName}</strong>?
                      </p>
                      <p className="text-xs text-red-500 mt-2">This action cannot be undone.</p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeleteTeacherModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteTeacher}
                        disabled={deleteTeacherLoading}
                        className="px-5 py-2 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {deleteTeacherLoading ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">System Users &amp; Roles</h1>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {systemUsers.length}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Administrators, Teachers, Bursars, and Staff accounts with access to {tenant?.name}.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition flex items-center gap-2"
                  >
                    <span>🔄</span> Import from Sheets
                  </button>
                  {can('users', 'create') && (
                      <button
                      onClick={openAddUserModal}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition flex items-center gap-2 self-start"
                    >
                      <span>➕</span> Add User
                    </button>
                  )}
                </div>
              </div>

              {/* Notice */}
              {userNotice && (
                <div className="p-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between">
                  <span>{userNotice}</span>
                  <button onClick={() => setUserNotice('')} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">✕</button>
                </div>
              )}

              {/* Search Bar */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Search by name, email, username, or role..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {userLoading ? 'Loading...' : `Showing ${filteredSystemUsers.length} of ${systemUsers.length}`}
                </span>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {userLoading ? (
                  <div className="py-16 text-center text-slate-400 text-sm">Loading users data...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">User ID</th>
                          <th className="py-3 px-4">Full Name</th>
                          <th className="py-3 px-4">Google / System Email</th>
                          <th className="py-3 px-4">Username</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSystemUsers.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                              {systemUsers.length === 0 ? (
                                <div className="space-y-3">
                                  <div className="text-3xl">👥</div>
                                  <p className="font-semibold text-slate-700">No users found.</p>
                                  <p className="text-xs text-slate-400">Click &ldquo;Add User&rdquo; to create the first account or import from Sheets.</p>
                                  {can('users', 'create') && (
                                      <button
                                      onClick={openAddUserModal}
                                      className="mt-1 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                                    >
                                      + Add First User
                                    </button>
                                  )}
                                </div>
                              ) : (
                                'No users match your search query.'
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredSystemUsers.map((u) => {
                            let roleBadgeClass = 'bg-blue-100 text-blue-800';
                            let roleLabel: string = u.role;
                            if (u.role === 'SCHOOL_ADMIN' || u.role === 'SUPER_ADMIN') {
                              roleBadgeClass = 'bg-amber-100 text-amber-800';
                              roleLabel = 'Admin';
                            } else if (u.role === 'BURSAR') {
                              roleBadgeClass = 'bg-pink-100 text-pink-800';
                              roleLabel = 'Bursar';
                            } else if (u.role === 'TEACHER') {
                              roleBadgeClass = 'bg-blue-100 text-blue-800';
                              roleLabel = 'Teacher';
                            } else if (u.role === 'VIEWER') {
                              roleBadgeClass = 'bg-slate-100 text-slate-700';
                              roleLabel = 'Viewer';
                            } else if (u.role === 'PARENT') {
                              roleBadgeClass = 'bg-emerald-100 text-emerald-800';
                              roleLabel = 'Parent';
                            }

                            let statusBadgeClass = 'bg-emerald-100 text-emerald-800';
                            let statusLabel = 'Active';
                            if (u.status === 'INACTIVE') {
                              statusBadgeClass = 'bg-rose-100 text-rose-800';
                              statusLabel = 'Revoked';
                            } else if (u.status === 'SUSPENDED') {
                              statusBadgeClass = 'bg-yellow-100 text-yellow-800';
                              statusLabel = 'Locked';
                            }

                            return (
                              <tr key={u.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-semibold text-indigo-600 text-xs">
                                  {u.id.length > 12 ? `${u.id.slice(0, 8)}...` : u.id}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                                <td className="py-3 px-4 text-slate-600 font-mono text-xs">{u.email}</td>
                                <td className="py-3 px-4 text-slate-500 font-mono text-xs">{u.username || '—'}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadgeClass}`}>
                                    {roleLabel}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {can('users', 'edit') && (
                                      <button
                                      onClick={() => openEditUserModal(u)}
                                      className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition text-base"
                                      title="Edit user"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                  {can('users', 'delete') && (
                                      <button
                                      onClick={() => openDeleteUserModal(u)}
                                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-base ml-1"
                                      title="Delete user"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ADD / EDIT USER MODAL */}
              {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">
                        {editingUser ? 'Edit User' : 'Add New User'}
                      </h3>
                      <button
                        onClick={() => setShowUserModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <form onSubmit={handleUserFormSubmit}>
                      <div className="px-6 py-5 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                            Google / System Email
                          </label>
                          <input
                            type="email"
                            required
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="user@example.com"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            required
                            value={userForm.fullName}
                            onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. John Doe"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Username
                            </label>
                            <input
                              type="text"
                              value={userForm.username}
                              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="e.g. jdoe"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                                Password
                              </label>
                              <button
                                type="button"
                                onClick={resetUserFormPassword}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                              >
                                Default Password
                              </button>
                            </div>
                            <input
                              type="text"
                              value={userForm.password}
                              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder={editingUser ? 'Leave blank to keep current' : 'e.g. Password123'}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Role
                            </label>
                            <select
                              value={userForm.role}
                              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                              <option value="SCHOOL_ADMIN">Admin (School Admin)</option>
                              <option value="BURSAR">Bursar (Accountant)</option>
                              <option value="TEACHER">Teacher</option>
                              <option value="VIEWER">Viewer</option>
                              <option value="PARENT">Parent</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Account Status
                            </label>
                            <select
                              value={userForm.status}
                              onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                              <option value="ACTIVE">Active</option>
                              <option value="INACTIVE">Revoked / Inactive</option>
                              <option value="SUSPENDED">Suspended / Locked</option>
                            </select>
                          </div>
                        </div>

                        {userFormError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {userFormError}
                          </p>
                        )}
                      </div>
                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowUserModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={userFormLoading}
                          className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                          {userFormLoading
                            ? editingUser ? 'Updating...' : 'Saving...'
                            : editingUser ? 'Update User' : 'Save User'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE CONFIRMATION MODAL */}
              {showDeleteUserModal && deletingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">Delete User</h3>
                      <button
                        onClick={() => setShowDeleteUserModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete user{' '}
                        <strong className="text-slate-900">{deletingUser.fullName} ({deletingUser.email})</strong>?
                      </p>
                      <p className="text-xs text-amber-600 font-medium mt-2">
                        ⚠️ Note: You cannot delete your own account or the last Admin user.
                      </p>
                      <p className="text-xs text-red-500 mt-1">This action cannot be undone.</p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeleteUserModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteUser}
                        disabled={deleteUserLoading}
                        className="px-5 py-2 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {deleteUserLoading ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PARENTS */}
          {activeTab === 'parents' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">Parents &amp; Guardians</h1>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {parentMappings.length}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Parent/student associations, emergency contacts, and fee billing linkages for {tenant?.name}.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition flex items-center gap-2"
                  >
                    <span>🔄</span> Import from Sheets
                  </button>
                  {can('parents', 'create') && (
                      <button
                      onClick={openAddParentModal}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 shadow-sm transition flex items-center gap-2 self-start"
                    >
                      <span>➕</span> Create Mapping
                    </button>
                  )}
                </div>
              </div>

              {/* Notice */}
              {parentNotice && (
                <div className="p-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between">
                  <span>{parentNotice}</span>
                  <button onClick={() => setParentNotice('')} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">✕</button>
                </div>
              )}

              {/* Search Bar */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Search by Parent Name, Mapping ID, Student, or Relationship..."
                  value={parentSearchQuery}
                  onChange={(e) => setParentSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {parentLoading ? 'Loading...' : `Showing ${filteredParentMappings.length} of ${parentMappings.length}`}
                </span>
              </div>

              {/* Parents Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {parentLoading ? (
                  <div className="py-16 text-center text-slate-400 text-sm">Loading parent mappings...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Mapping ID</th>
                          <th className="py-3 px-4">Parent / Guardian Name</th>
                          <th className="py-3 px-4">Student ID &amp; Name</th>
                          <th className="py-3 px-4">Relationship</th>
                          <th className="py-3 px-4">Primary Contact</th>
                          <th className="py-3 px-4">Billing</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredParentMappings.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                              {parentMappings.length === 0 ? (
                                <div className="space-y-3">
                                  <div className="text-3xl">👨‍👩‍👧‍👦</div>
                                  <p className="font-semibold text-slate-700">No parent mappings found.</p>
                                  <p className="text-xs text-slate-400">Click &ldquo;Create Mapping&rdquo; to link a parent to a pupil or import from Sheets.</p>
                                  {can('parents', 'create') && (
                                      <button
                                      onClick={openAddParentModal}
                                      className="mt-1 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                                    >
                                      + Create First Mapping
                                    </button>
                                  )}
                                </div>
                              ) : (
                                'No parent mappings match your search query.'
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredParentMappings.map((p) => {
                            const studentDisplay = p.student
                              ? `${p.student.firstName} ${p.student.lastName}`
                              : 'Unknown Student';
                            const studentCode = p.student?.studentId || p.studentId;

                            return (
                              <tr key={p.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-semibold text-emerald-700 text-xs">
                                  {p.mappingId}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900">
                                  <div>{p.parentName}</div>
                                  {p.phone && <div className="text-[11px] font-normal text-slate-500">{p.phone}</div>}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900">{studentDisplay}</div>
                                  <div className="font-mono text-xs text-blue-600">{studentCode}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                    {p.relationship || 'Guardian'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  {p.isPrimary ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                      No
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {p.billing === 'Yes' ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                      No
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {can('parents', 'edit') && (
                                      <button
                                      onClick={() => openEditParentModal(p)}
                                      className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition text-base"
                                      title="Edit mapping"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                  {can('parents', 'delete') && (
                                      <button
                                      onClick={() => openDeleteParentModal(p)}
                                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-base ml-1"
                                      title="Delete mapping"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ADD / EDIT PARENT MAPPING MODAL */}
              {showParentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">
                        {editingParent ? 'Edit Parent Mapping' : 'Create Parent Mapping'}
                      </h3>
                      <button
                        onClick={() => setShowParentModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <form onSubmit={handleParentFormSubmit}>
                      <div className="px-6 py-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Parent Name
                            </label>
                            <input
                              type="text"
                              required
                              value={parentForm.parentName}
                              onChange={(e) => setParentForm({ ...parentForm, parentName: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g. Ama Osei"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Linked Parent User (Optional)
                            </label>
                            <select
                              value={parentForm.parentUserId}
                              onChange={(e) => setParentForm({ ...parentForm, parentUserId: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="">None / Unlinked</option>
                              {systemUsers.map((su) => (
                                <option key={su.id} value={su.id}>
                                  {su.fullName} ({su.email})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                            Associated Student
                          </label>
                          <select
                            required
                            value={parentForm.studentId}
                            onChange={(e) => setParentForm({ ...parentForm, studentId: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option value="" disabled>Select Student</option>
                            {students.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.studentId} — {st.firstName} {st.lastName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Relationship
                            </label>
                            <select
                              value={parentForm.relationship}
                              onChange={(e) => setParentForm({ ...parentForm, relationship: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="Mother">Mother</option>
                              <option value="Father">Father</option>
                              <option value="Guardian">Guardian</option>
                              <option value="Sponsor">Sponsor</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Primary Contact?
                            </label>
                            <select
                              value={parentForm.isPrimary ? 'TRUE' : 'FALSE'}
                              onChange={(e) => setParentForm({ ...parentForm, isPrimary: e.target.value === 'TRUE' })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="FALSE">No</option>
                              <option value="TRUE">Yes</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Billing Contact?
                            </label>
                            <select
                              value={parentForm.billing}
                              onChange={(e) => setParentForm({ ...parentForm, billing: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Phone Number (Optional)
                            </label>
                            <input
                              type="tel"
                              value={parentForm.phone}
                              onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g. +233 24 123 4567"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Email Address (Optional)
                            </label>
                            <input
                              type="email"
                              value={parentForm.email}
                              onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="e.g. parent@example.com"
                            />
                          </div>
                        </div>

                        {parentFormError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {parentFormError}
                          </p>
                        )}
                      </div>
                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowParentModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={parentFormLoading}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          {parentFormLoading
                            ? editingParent ? 'Updating...' : 'Saving...'
                            : editingParent ? 'Update Mapping' : 'Save Mapping'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE CONFIRMATION MODAL */}
              {showDeleteParentModal && deletingParent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">Delete Mapping</h3>
                      <button
                        onClick={() => setShowDeleteParentModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete parent mapping{' '}
                        <strong className="text-slate-900">{deletingParent.mappingId}</strong> ({deletingParent.parentName} → {deletingParent.student ? `${deletingParent.student.firstName} ${deletingParent.student.lastName}` : deletingParent.studentId})?
                      </p>
                      <p className="text-xs text-red-500 mt-2">This action cannot be undone.</p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeleteParentModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteParent}
                        disabled={deleteParentLoading}
                        className="px-5 py-2 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {deleteParentLoading ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">🛡️ System Permissions &amp; Roles</h1>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {permissions.length}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Build each role's permitted actions from the sidebar pages — exactly what is checked is exactly what that role will see.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {can('migration') && (
                      <button
                        onClick={() => setActiveTab('migration')}
                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition flex items-center gap-2"
                      >
                        <span>🔄</span> Import from Sheets
                      </button>
                  )}
                  {isAdminUser && (
                    <button
                      onClick={openAddPermissionModal}
                      className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 shadow-sm transition flex items-center gap-2 self-start"
                    >
                      <span>➕</span> Add Permission
                    </button>
                  )}
                </div>
              </div>

              {/* Roles without a policy keep full access */}
              {!permissionLoading && unmanagedRoles.length > 0 && (
                <div className="p-3 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-start justify-between gap-3">
                  <span>
                    ⚠️ No permission policy defined for{' '}
                    {unmanagedRoles.map((r, i) => (
                      <span key={r.value}>
                        {i > 0 && ', '}
                        <strong>{r.label}</strong>
                      </span>
                    ))}
                    . These roles currently see <strong>every page</strong>. Add a policy to restrict them.
                  </span>
                  {isAdminUser && (
                    <button
                      onClick={openAddPermissionModal}
                      className="shrink-0 px-3 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition"
                    >
                      + Add Policy
                    </button>
                  )}
                </div>
              )}

              {/* Notice */}
              {permissionNotice && (
                <div className="p-3 rounded-xl text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 flex items-center justify-between">
                  <span>{permissionNotice}</span>
                  <button onClick={() => setPermissionNotice('')} className="text-purple-600 hover:text-purple-900 font-bold ml-2">✕</button>
                </div>
              )}

              {/* Search Bar */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Search by Role, Access Level, or Permitted Actions..."
                  value={permissionSearchQuery}
                  onChange={(e) => setPermissionSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {permissionLoading ? 'Loading...' : `Showing ${filteredPermissions.length} of ${permissions.length}`}
                </span>
              </div>

              {/* Permissions Matrix Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {permissionLoading ? (
                  <div className="py-16 text-center text-slate-400 text-sm">Loading permissions data...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 w-48">Role</th>
                          <th className="py-3 px-4 w-44">Access Level</th>
                          <th className="py-3 px-4">Visible Pages &amp; Permitted Actions</th>
                          <th className="py-3 px-4 text-center w-28">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPermissions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-slate-500 text-sm">
                              {permissions.length === 0 ? (
                                <div className="space-y-3">
                                  <div className="text-3xl">🛡️</div>
                                  <p className="font-semibold text-slate-700">No permission policies defined.</p>
                                  <p className="text-xs text-slate-400">Click &ldquo;Add Permission&rdquo; to build a role policy from the sidebar pages — every role currently sees everything.</p>
                                  {isAdminUser && (
                                    <button
                                      onClick={openAddPermissionModal}
                                      className="mt-1 px-4 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700"
                                    >
                                      + Add First Permission
                                    </button>
                                  )}
                                </div>
                              ) : (
                                'No permissions match your search query.'
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredPermissions.map((p) => {
                            let badgeClass = 'bg-slate-100 text-slate-700';
                            const lvl = p.accessLevel.toLowerCase();
                            if (lvl.includes('full')) {
                              badgeClass = 'bg-emerald-100 text-emerald-800';
                            } else if (lvl.includes('financial')) {
                              badgeClass = 'bg-amber-100 text-amber-800';
                            } else if (lvl.includes('read only') || lvl.includes('readonly')) {
                              badgeClass = 'bg-blue-100 text-blue-800';
                            } else if (lvl.includes('restricted')) {
                              badgeClass = 'bg-rose-100 text-rose-800';
                            } else if (lvl.includes('class')) {
                              badgeClass = 'bg-indigo-100 text-indigo-800';
                            }

                            const rowPolicy = parsePermPolicy(p.actions);
                            const rowPages = rowPolicy
                              ? PERM_PAGES.filter((pg) => (rowPolicy[pg.key] || []).length > 0)
                              : [];
                            const isLegacyPolicy = !rowPolicy;
                            const isOwnRole = p.role.trim().toUpperCase() === (user?.role || '').toUpperCase();

                            return (
                              <tr key={p.id} className="hover:bg-slate-50/50 align-top">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900 flex items-center gap-2">
                                    {permRoleLabel(p.role)}
                                    {isOwnRole && (
                                      <span
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200"
                                        title="This is the policy applied to your own account"
                                      >
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.role}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
                                    {p.accessLevel}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  {isLegacyPolicy ? (
                                    <p className="text-slate-500 text-xs italic leading-relaxed" title="Legacy free-text policy — edit it to convert to the page checkbox builder">
                                      {p.actions || '—'}
                                      <span className="block not-italic text-[10px] text-amber-600 font-semibold mt-1">
                                        Legacy free-text policy — edit to rebuild with page checkboxes.
                                      </span>
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="flex flex-wrap gap-1.5">
                                        {rowPages.length === 0 && (
                                          <span className="text-xs text-slate-400 italic">No pages — this role sees nothing.</span>
                                        )}
                                        {rowPages.map((pg) => {
                                          const acts = rowPolicy[pg.key] || [];
                                          return (
                                            <span
                                              key={pg.key}
                                              title={`${pg.label}: ${acts.map((a) => PERM_ACTION_LABELS[a]).join(', ')}`}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                                            >
                                              <span>{pg.icon}</span>
                                              {pg.label}
                                              {acts.length > 1 && (
                                                <span className="text-purple-600 font-bold">
                                                  {acts
                                                    .filter((a) => a !== 'view')
                                                    .map((a) => a[0].toUpperCase())
                                                    .join('·')}
                                                </span>
                                              )}
                                            </span>
                                          );
                                        })}
                                      </div>
                                      <p className="text-[11px] text-slate-400 font-medium">
                                        {rowPages.length} of {PERM_PAGES.length} sidebar pages
                                      </p>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isAdminUser ? (
                                    <>
                                      <button
                                        onClick={() => openEditPermissionModal(p)}
                                        className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition text-base"
                                        title="Edit permission"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => openDeletePermissionModal(p)}
                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-base ml-1"
                                        title="Delete permission"
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-semibold">View only</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ADD / EDIT PERMISSION MODAL — page-based checkbox builder */}
              {showPermissionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center gap-4 shrink-0">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {editingPermission ? 'Edit Permission Policy' : 'Add New Permission Policy'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Check the sidebar pages this role can see and what they can do on each — what is checked is exactly what they get.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowPermissionModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none shrink-0"
                      >
                        &times;
                      </button>
                    </div>
                    <form onSubmit={handlePermissionFormSubmit} className="flex flex-col min-h-0 flex-1">
                      <div className="px-6 py-5 space-y-5 overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              System Role *
                            </label>
                            <select
                              required
                              value={PERM_ROLES.some((r) => r.value === permissionForm.role) ? permissionForm.role : ''}
                              onChange={(e) => setPermissionForm({ ...permissionForm, role: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            >
                              <option value="" disabled>
                                Select a role…
                              </option>
                              {PERM_ROLES.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label} — {r.description}
                                </option>
                              ))}
                              {editingPermission && !PERM_ROLES.some((r) => r.value === permissionForm.role) && permissionForm.role && (
                                <option value={permissionForm.role}>
                                  {permissionForm.role} (legacy — choose a system role)
                                </option>
                              )}
                            </select>
                            {permissionForm.role && permissionForm.role === user?.role && (
                              <p className="text-[11px] text-amber-600 font-semibold mt-1.5">
                                ⚠️ You are editing the policy for your own role — unchecking pages hides them from your own sidebar too.
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Access Level *
                            </label>
                            <select
                              value={permissionForm.accessLevel}
                              onChange={(e) => setPermissionForm({ ...permissionForm, accessLevel: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            >
                              <option value="Full Access">Full Access</option>
                              <option value="Financial Control">Financial Control</option>
                              <option value="Class Management">Class Management</option>
                              <option value="Read Only">Read Only</option>
                              <option value="Restricted Access">Restricted Access</option>
                            </select>
                          </div>
                        </div>

                        {permissionFormLegacyText && (
                          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-medium">
                            This policy used legacy free-text actions: &ldquo;{permissionFormLegacyText}&rdquo;. Rebuild it below with the page
                            checkboxes.
                          </div>
                        )}

                        {/* Matrix toolbar */}
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                              Permitted Actions *
                            </label>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {permCheckedPages.length} of {PERM_PAGES.length} pages visible — only checked pages appear in this role&apos;s sidebar.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={permSelectAll}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={permClearAll}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        {/* Page groups — mirrors the sidebar sections */}
                        <div className="space-y-4">
                          {PERM_SECTIONS.map((section) => {
                            const sectionPages = PERM_PAGES.filter((p) => p.section === section.key);
                            if (sectionPages.length === 0) return null;
                            const allChecked = sectionPages.every(
                              (p) => (permissionForm.checks[p.key] || []).length === p.actions.length
                            );
                            const someChecked = sectionPages.some((p) => (permissionForm.checks[p.key] || []).length > 0);
                            return (
                              <div key={section.key} className="border border-slate-200 rounded-xl overflow-hidden">
                                {/* Section header */}
                                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-base">{section.icon}</span>
                                    <div className="min-w-0">
                                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                        {section.label}
                                      </span>
                                      <p className="text-[10px] text-slate-400 truncate">{section.description}</p>
                                    </div>
                                  </div>
                                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="Toggle every page in this group">
                                    <input
                                      type="checkbox"
                                      checked={allChecked}
                                      ref={(el) => {
                                        if (el) el.indeterminate = someChecked && !allChecked;
                                      }}
                                      onChange={() => togglePermSection(section.key)}
                                      className="h-4 w-4 accent-purple-600 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">All</span>
                                  </label>
                                </div>

                                {/* Column headers */}
                                <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,64px)] sm:grid-cols-[minmax(0,1fr)_repeat(4,84px)] items-center px-4 py-1.5 border-b border-slate-100 bg-white">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sidebar Page</span>
                                  {(['view', 'create', 'edit', 'delete'] as PermAction[]).map((a) => (
                                    <span key={a} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                                      {a === 'view' ? 'See' : a === 'create' ? 'Add' : a === 'edit' ? 'Edit' : 'Delete'}
                                    </span>
                                  ))}
                                </div>

                                {/* Page rows */}
                                <div className="divide-y divide-slate-100">
                                  {sectionPages.map((page) => {
                                    const checked = permissionForm.checks[page.key] || [];
                                    const canSee = checked.includes('view');
                                    return (
                                      <div
                                        key={page.key}
                                        className={`grid grid-cols-[minmax(0,1fr)_repeat(4,64px)] sm:grid-cols-[minmax(0,1fr)_repeat(4,84px)] items-center px-4 py-2.5 transition ${
                                          canSee ? 'bg-white' : 'bg-slate-50/60'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                          <span className={`text-base shrink-0 ${canSee ? '' : 'grayscale opacity-50'}`}>{page.icon}</span>
                                          <div className="min-w-0">
                                            <span
                                              className={`text-sm font-semibold block truncate ${
                                                canSee ? 'text-slate-800' : 'text-slate-400'
                                              }`}
                                            >
                                              {page.label}
                                            </span>
                                            {page.hint && (
                                              <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">{page.hint}</span>
                                            )}
                                          </div>
                                        </div>
                                        {(['view', 'create', 'edit', 'delete'] as PermAction[]).map((action) => {
                                          const available = page.actions.includes(action);
                                          const isChecked = checked.includes(action);
                                          return (
                                            <div key={action} className="flex items-center justify-center">
                                              {available ? (
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => togglePermCheck(page.key, action)}
                                                  className="h-4 w-4 accent-purple-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                  disabled={!canSee && action !== 'view'}
                                                  title={
                                                    action === 'view'
                                                      ? `Can see the ${page.label} page (sidebar)`
                                                      : `${PERM_ACTION_LABELS[action]} on ${page.label}`
                                                  }
                                                />
                                              ) : (
                                                <span className="text-slate-300 text-xs" title="Not applicable to this page">
                                                  —
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {permissionFormError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {permissionFormError}
                          </p>
                        )}
                      </div>
                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                        <p className="text-[11px] text-slate-500 hidden sm:block">
                          {permRoleLabel(permissionForm.role) || 'This role'} will see{' '}
                          <strong className="text-slate-700">{permCheckedPages.length}</strong> of {PERM_PAGES.length} sidebar pages.
                        </p>
                        <div className="flex justify-end gap-3 ml-auto">
                          <button
                            type="button"
                            onClick={() => setShowPermissionModal(false)}
                            className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={permissionFormLoading}
                            className="px-5 py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition disabled:opacity-50"
                          >
                            {permissionFormLoading
                              ? editingPermission ? 'Updating...' : 'Saving...'
                              : editingPermission ? 'Update Permission' : 'Save Permission'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE CONFIRMATION MODAL */}
              {showDeletePermissionModal && deletingPermission && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">Delete Permission</h3>
                      <button
                        onClick={() => setShowDeletePermissionModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete permission role{' '}
                        <strong className="text-slate-900">{deletingPermission.role}</strong>?
                      </p>
                      <p className="text-xs text-amber-600 font-medium mt-2">
                        ⚠️ Note: The core Administrator role cannot be deleted.
                      </p>
                      <p className="text-xs text-red-500 mt-1">This action cannot be undone.</p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeletePermissionModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeletePermission}
                        disabled={deletePermissionLoading}
                        className="px-5 py-2 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {deletePermissionLoading ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: SUBJECTS */}
          {activeTab === 'subjects' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Subjects &amp; Curriculum</h1>
                  <p className="text-sm text-slate-500">Manage courses and instructional subjects taught across grade levels.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition flex items-center gap-2"
                  >
                    <span>🔄</span> Import from Sheets
                  </button>
                  {can('subjects', 'create') && (
                      <button
                      onClick={openAddSubjectModal}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition flex items-center gap-2 self-start"
                    >
                      <span>➕</span> Add Subject
                    </button>
                  )}
                </div>
              </div>

              {/* Notice */}
              {subjectNotice && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-between">
                  <span>✅ {subjectNotice}</span>
                  <button onClick={() => setSubjectNotice('')} className="text-emerald-600 hover:text-emerald-900 text-sm leading-none">
                    &times;
                  </button>
                </div>
              )}

              {/* Search + Status Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Search by subject, code, or instructor..."
                  value={subjectSearchQuery}
                  onChange={(e) => setSubjectSearchQuery(e.target.value)}
                  className="flex-1 w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={subjectStatusFilter}
                  onChange={(e) => setSubjectStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {subjectLoading
                    ? 'Loading...'
                    : `Showing ${filteredSubjects.length} of ${subjects.length}`}
                </span>
              </div>

              {/* Subjects Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {subjectLoading ? (
                  <div className="py-16 text-center text-slate-400 text-sm">Loading subjects...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Code</th>
                          <th className="py-3 px-4">Subject</th>
                          <th className="py-3 px-4">Instructor</th>
                          <th className="py-3 px-4">Credits</th>
                          <th className="py-3 px-4">Semester</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSubjects.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                              {subjects.length === 0 ? (
                                <div className="space-y-3">
                                  <div className="text-3xl">📚</div>
                                  <p className="font-semibold text-slate-700">No subjects added yet.</p>
                                  <p className="text-xs text-slate-400">
                                    Click &ldquo;Add Subject&rdquo; to get started, or import from Google Sheets.
                                  </p>
                                  {can('subjects', 'create') && (
                                      <button
                                      onClick={openAddSubjectModal}
                                      className="mt-1 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                    >
                                      + Add First Subject
                                    </button>
                                  )}
                                </div>
                              ) : (
                                'No subjects match your search.'
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredSubjects.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-mono font-semibold text-blue-600">{s.code || '—'}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                              <td className="py-3 px-4 text-slate-700">{s.instructorName || '—'}</td>
                              <td className="py-3 px-4 text-slate-600">{s.credits}</td>
                              <td className="py-3 px-4 text-slate-600">{s.semester || '—'}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                    s.status === 'INACTIVE'
                                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {s.status === 'INACTIVE' ? 'Inactive' : 'Active'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {can('subjects', 'edit') && (
                                    <button
                                    onClick={() => openEditSubjectModal(s)}
                                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition text-base"
                                    title="Edit subject"
                                  >
                                    ✏️
                                  </button>
                                )}
                                {can('subjects', 'delete') && (
                                    <button
                                    onClick={() => openDeleteSubjectModal(s)}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-base ml-1"
                                    title="Delete subject"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ADD / EDIT SUBJECT MODAL */}
              {showSubjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">
                        {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                      </h3>
                      <button
                        onClick={() => setShowSubjectModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <form onSubmit={handleSubjectFormSubmit} className="flex flex-col overflow-y-auto">
                      <div className="px-6 py-5 space-y-4">
                        {subjectFormError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                            {subjectFormError}
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Name *</label>
                          <input
                            type="text"
                            required
                            value={subjectForm.name}
                            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Integrated Science"
                          />
                          {editingSubject?.code && (
                            <p className="text-[11px] text-slate-400 mt-1">
                              Code <span className="font-mono font-semibold">{editingSubject.code}</span> is assigned automatically.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Instructor</label>
                          <input
                            type="text"
                            value={subjectForm.instructor}
                            onChange={(e) => setSubjectForm({ ...subjectForm, instructor: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Dr. Smith"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Credits *</label>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              required
                              value={subjectForm.credits}
                              onChange={(e) => setSubjectForm({ ...subjectForm, credits: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g. 3"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                            <input
                              type="text"
                              list="subject-semester-options"
                              value={subjectForm.semester}
                              onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Optional"
                            />
                            <datalist id="subject-semester-options">
                              <option value="Term 1" />
                              <option value="Term 2" />
                              <option value="Term 3" />
                            </datalist>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                          <select
                            value={subjectForm.status}
                            onChange={(e) => setSubjectForm({ ...subjectForm, status: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </div>
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowSubjectModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={subjectFormLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {subjectFormLoading
                            ? 'Saving...'
                            : editingSubject
                              ? 'Update Subject'
                              : 'Save Subject'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE SUBJECT MODAL */}
              {showDeleteSubjectModal && deletingSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">Delete Subject</h3>
                      <button
                        onClick={() => setShowDeleteSubjectModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete subject{' '}
                        <strong className="text-slate-900">{deletingSubject.name}</strong>?
                      </p>
                      <p className="text-xs text-red-500 mt-2">This action cannot be undone.</p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeleteSubjectModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteSubject}
                        disabled={deleteSubjectLoading}
                        className="px-5 py-2 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {deleteSubjectLoading ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: ENROLLMENTS */}
          {activeTab === 'enrollments' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Student Course Enrollments</h1>
                  <p className="text-sm text-slate-500">Track pupil subject enrollments, completion statuses, and grade assignments.</p>
                </div>
                {can('enrollments', 'create') && (
                    <button onClick={() => setShowEnrollModal(true)} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                    ➕ Enroll Student
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  📝
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Enrollment Records</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Synced with <code className="bg-slate-100 text-teal-700 px-1.5 py-0.5 rounded font-mono font-bold">Enrollment</code> table in Neon DB. Links students with subjects, teachers, and class streams.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  {can('students') && (
                      <button onClick={() => setActiveTab('students')} className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition">
                        View Enrolled Students ({stats?.studentCount || 0})
                      </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">✅ Daily Attendance Register</h1>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {filteredAttendance.length} {filteredAttendance.length === 1 ? 'Record' : 'Records'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Record daily student roll calls, monitor attendance rates, and manage student presence records.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
                  >
                    Sync from Sheets
                  </button>
                  {can('attendance', 'create') && (
                      <button
                      onClick={openMarkAttendanceModal}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center gap-1.5"
                    >
                      <span>+</span> Mark Attendance
                    </button>
                  )}
                </div>
              </div>

              {/* Notice Banner */}
              {attendanceNotice && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-sm">
                  <span>{attendanceNotice}</span>
                  <button
                    onClick={() => setAttendanceNotice('')}
                    className="text-emerald-500 hover:text-emerald-800 font-bold ml-4"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Entries</span>
                    <span className="text-2xl font-extrabold text-slate-900">{attendanceList.length}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center font-bold text-lg">
                    📋
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Present Rate</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-extrabold text-emerald-600">
                        {attendanceList.length > 0
                          ? Math.round(
                              (attendanceList.filter((a) => a.status === 'PRESENT').length / attendanceList.length) * 100
                            )
                          : 0}
                        %
                      </span>
                      <span className="text-xs text-slate-400">
                        ({attendanceList.filter((a) => a.status === 'PRESENT').length})
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                    ✅
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Absent Count</span>
                    <span className="text-2xl font-extrabold text-red-600">
                      {attendanceList.filter((a) => a.status === 'ABSENT').length}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">
                    ❌
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Late Count</span>
                    <span className="text-2xl font-extrabold text-amber-600">
                      {attendanceList.filter((a) => a.status === 'LATE').length}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
                    ⏳
                  </div>
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                    <input
                      type="text"
                      placeholder="Search by student name, ID, class, or remarks..."
                      value={attendanceSearchQuery}
                      onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date filter */}
                    <input
                      type="date"
                      value={attendanceDateFilter}
                      onChange={(e) => setAttendanceDateFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      title="Filter by specific date"
                    />

                    {/* Class filter */}
                    <select
                      value={attendanceClassFilter}
                      onChange={(e) => setAttendanceClassFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">All Classes</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    {/* Status filter */}
                    <select
                      value={attendanceStatusFilter}
                      onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">All Statuses</option>
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="LATE">Late</option>
                      <option value="EXCUSED">Excused</option>
                    </select>

                    {/* Term filter */}
                    <select
                      value={attendanceTermFilter}
                      onChange={(e) => setAttendanceTermFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">All Terms</option>
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>

                    {(attendanceSearchQuery ||
                      attendanceDateFilter ||
                      attendanceClassFilter ||
                      attendanceStatusFilter ||
                      attendanceTermFilter) && (
                      <button
                        onClick={() => {
                          setAttendanceSearchQuery('');
                          setAttendanceDateFilter('');
                          setAttendanceClassFilter('');
                          setAttendanceStatusFilter('');
                          setAttendanceTermFilter('');
                        }}
                        className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {filteredAttendance.length} {filteredAttendance.length === 1 ? 'Attendance Entry' : 'Attendance Entries'}
                  </span>
                  <button
                    onClick={fetchAttendance}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
                  >
                    {attendanceLoading ? 'Refreshing...' : '↻ Refresh'}
                  </button>
                </div>

                {attendanceLoading && attendanceList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mb-2"></div>
                    <p>Loading attendance records...</p>
                  </div>
                ) : filteredAttendance.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-3">
                    <p className="text-base font-semibold text-slate-700">No attendance records found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {attendanceSearchQuery || attendanceDateFilter || attendanceClassFilter || attendanceStatusFilter
                        ? 'No records match the current filters. Try changing or clearing your search options.'
                        : 'No daily attendance records have been marked yet. Click "+ Mark Attendance" to begin.'}
                    </p>
                    {!attendanceSearchQuery && !attendanceDateFilter && can('attendance', 'create') && (
                      <button
                        onClick={openMarkAttendanceModal}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition"
                      >
                        + Mark First Attendance
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/60 font-semibold">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Class</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Year & Term</th>
                          <th className="py-3 px-4">Remarks</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredAttendance.map((a) => {
                          const dateFormatted = a.date ? a.date.split('T')[0] : '-';
                          return (
                            <tr key={a.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-4 font-mono font-medium text-slate-600">
                                {dateFormatted}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">
                                  {a.student ? `${a.student.firstName} ${a.student.lastName}` : 'Unknown Student'}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {a.student?.studentId || '-'}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                                  {a.class?.name || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {a.status === 'PRESENT' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Present
                                  </span>
                                )}
                                {a.status === 'ABSENT' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                                    Absent
                                  </span>
                                )}
                                {a.status === 'LATE' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    Late
                                  </span>
                                )}
                                {a.status === 'EXCUSED' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                    Excused
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                <div>{a.academicYear?.year || '-'}</div>
                                <div className="text-[11px] text-slate-400">{a.term}</div>
                              </td>
                              <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                                {a.notes || <span className="text-slate-300 italic">None</span>}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {can('attendance', 'edit') && (
                                      <button
                                      onClick={() => openEditAttendanceModal(a)}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition"
                                      title="Edit record"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                  {can('attendance', 'delete') && (
                                      <button
                                      onClick={() => openDeleteAttendanceModal(a)}
                                      className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition"
                                      title="Delete record"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* MARK ATTENDANCE (BULK CLASS ROLL CALL) MODAL */}
              {showMarkAttendanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Mark Class Attendance</h3>
                        <p className="text-xs text-slate-500">Conduct daily roll call and record presence for an entire class.</p>
                      </div>
                      <button
                        onClick={() => setShowMarkAttendanceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleBulkAttendanceSubmit} className="flex flex-col flex-1 overflow-hidden">
                      <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {/* Session selection row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Date *
                            </label>
                            <input
                              type="date"
                              required
                              value={markAttendanceDate}
                              onChange={(e) => setMarkAttendanceDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Class *
                            </label>
                            <select
                              required
                              value={markAttendanceClassId}
                              onChange={(e) => loadClassRoster(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="" disabled>-- Select Class --</option>
                              {classesList.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Academic Year *
                            </label>
                            <select
                              required
                              value={markAttendanceYearId}
                              onChange={(e) => setMarkAttendanceYearId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="" disabled>-- Select Year --</option>
                              {academicYears.map((y) => (
                                <option key={y.id} value={y.id}>
                                  {y.year} {y.status === 'ACTIVE' ? '(Active)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Term *
                            </label>
                            <select
                              required
                              value={markAttendanceTerm}
                              onChange={(e) => setMarkAttendanceTerm(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                            </select>
                          </div>
                        </div>

                        {/* Roster Section */}
                        {markAttendanceClassId && (
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            {/* Quick Mark All Bar */}
                            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-700">
                                Student Roster ({rosterStudents.length} Enrolled)
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500">Mark all:</span>
                                <button
                                  type="button"
                                  onClick={() => handleMarkAllStatus('PRESENT')}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition"
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkAllStatus('ABSENT')}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 transition"
                                >
                                  Absent
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkAllStatus('LATE')}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition"
                                >
                                  Late
                                </button>
                              </div>
                            </div>

                            {/* Roster Items */}
                            {rosterLoading ? (
                              <div className="p-8 text-center text-slate-400 text-xs">
                                <div className="inline-block animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full mb-1"></div>
                                <p>Loading class roster...</p>
                              </div>
                            ) : rosterStudents.length === 0 ? (
                              <div className="p-8 text-center text-slate-400 text-xs">
                                No active students found in this class. You can enroll students from the Students tab.
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                                {rosterStudents.map((s) => {
                                  const currentStatus = rosterStatusMap[s.id] || 'PRESENT';
                                  return (
                                    <div
                                      key={s.id}
                                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition"
                                    >
                                      <div>
                                        <div className="font-semibold text-slate-900 text-xs">
                                          {s.firstName} {s.lastName}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                          {s.studentId}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => (
                                          <button
                                            key={st}
                                            type="button"
                                            onClick={() =>
                                              setRosterStatusMap({
                                                ...rosterStatusMap,
                                                [s.id]: st,
                                              })
                                            }
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                                              currentStatus === st
                                                ? st === 'PRESENT'
                                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                  : st === 'ABSENT'
                                                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                  : st === 'LATE'
                                                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                  : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                          >
                                            {st.charAt(0) + st.slice(1).toLowerCase()}
                                          </button>
                                        ))}

                                        {/* Optional note input */}
                                        <input
                                          type="text"
                                          placeholder="Remarks..."
                                          value={rosterNotesMap[s.id] || ''}
                                          onChange={(e) =>
                                            setRosterNotesMap({
                                              ...rosterNotesMap,
                                              [s.id]: e.target.value,
                                            })
                                          }
                                          className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] w-28 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {markAttendanceError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {markAttendanceError}
                          </p>
                        )}
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowMarkAttendanceModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={markAttendanceSubmitting || rosterStudents.length === 0}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          {markAttendanceSubmitting ? 'Saving Roll Call...' : 'Save Attendance Roll Call'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* EDIT SINGLE ATTENDANCE MODAL */}
              {showEditAttendanceModal && editingAttendance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">Edit Attendance Record</h3>
                      <button
                        onClick={() => setShowEditAttendanceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleEditAttendanceSubmit}>
                      <div className="p-6 space-y-4">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                          <div className="font-semibold text-slate-800">
                            {editingAttendance.student
                              ? `${editingAttendance.student.firstName} ${editingAttendance.student.lastName}`
                              : 'Student'}
                          </div>
                          <div className="text-slate-500">
                            Class: <strong className="text-slate-700">{editingAttendance.class?.name || '-'}</strong> | Date: <strong className="text-slate-700">{editingAttendance.date?.split('T')[0]}</strong>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                            Attendance Status *
                          </label>
                          <select
                            value={editAttendanceStatus}
                            onChange={(e) =>
                              setEditAttendanceStatus(
                                e.target.value as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
                              )
                            }
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                            <option value="LATE">Late</option>
                            <option value="EXCUSED">Excused</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                            Remarks / Reason
                          </label>
                          <textarea
                            rows={3}
                            value={editAttendanceNotes}
                            onChange={(e) => setEditAttendanceNotes(e.target.value)}
                            placeholder="Optional explanation or reason for absence/tardiness..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {editAttendanceError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {editAttendanceError}
                          </p>
                        )}
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowEditAttendanceModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editAttendanceLoading}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          {editAttendanceLoading ? 'Updating...' : 'Update Record'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE CONFIRMATION MODAL */}
              {showDeleteAttendanceModal && deletingAttendance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>⚠️</span> Delete Attendance
                      </h3>
                      <button
                        onClick={() => setShowDeleteAttendanceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5 space-y-2">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete the attendance record for{' '}
                        <strong className="text-slate-900">
                          {deletingAttendance.student
                            ? `${deletingAttendance.student.firstName} ${deletingAttendance.student.lastName}`
                            : 'Student'}
                        </strong>{' '}
                        on <strong className="text-slate-900">{deletingAttendance.date?.split('T')[0]}</strong>?
                      </p>
                      <p className="text-xs text-slate-400">
                        This action will remove the record from terminal attendance calculations.
                      </p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowDeleteAttendanceModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAttendance}
                        disabled={deleteAttendanceLoading}
                        className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {deleteAttendanceLoading ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: ACADEMIC YEARS */}
          {activeTab === 'academic-years' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Academic Years &amp; Terms</h1>
                  <p className="text-sm text-slate-500">Configure academic sessions and the current term for {tenant?.name}.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition flex items-center gap-2"
                  >
                    <span>🔄</span> Import from Sheets
                  </button>
                  {can('academic_years', 'create') && (
                      <button
                      onClick={openAddYearModal}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition flex items-center gap-2 self-start"
                    >
                      <span>➕</span> Add Academic Year
                    </button>
                  )}
                </div>
              </div>

              {/* Notice */}
              {yearNotice && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-between">
                  <span>✅ {yearNotice}</span>
                  <button onClick={() => setYearNotice('')} className="text-emerald-600 hover:text-emerald-900 text-sm leading-none">
                    &times;
                  </button>
                </div>
              )}

              {/* Current Session Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Active Session: {stats?.activeYear || '—'}
                    </h3>
                    <p className="text-xs text-slate-500">Current Term: {stats?.currentTerm || 'Term 1'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    🟢 CURRENT SESSION
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Only one academic year can be <strong>Active</strong> at a time. Marking a year active automatically
                  archives the previous one. Filters, invoices, and attendance all follow the active session.
                </p>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Search academic years..."
                  value={yearSearchQuery}
                  onChange={(e) => setYearSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {yearLoading
                    ? 'Loading...'
                    : `Showing ${filteredAcademicYears.length} of ${academicYears.length}`}
                </span>
              </div>

              {/* Academic Years List */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {yearLoading ? (
                  <div className="py-16 text-center text-slate-400 text-sm">Loading academic years...</div>
                ) : filteredAcademicYears.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm space-y-3">
                    {academicYears.length === 0 ? (
                      <>
                        <div className="text-3xl">🗓️</div>
                        <p className="font-semibold text-slate-700">No academic years found.</p>
                        <p className="text-xs text-slate-400">Click &ldquo;Add Academic Year&rdquo; to create your first session.</p>
                        {can('academic_years', 'create') && (
                            <button
                            onClick={openAddYearModal}
                            className="mt-1 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                          >
                            + Add First Academic Year
                          </button>
                        )}
                      </>
                    ) : (
                      'No academic years match your search.'
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filteredAcademicYears.map((y) => (
                      <li
                        key={y.id}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-wrap">
                          <h4 className="font-bold text-slate-900">{y.year}</h4>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {y.currentTerm || 'Term 1'}
                          </span>
                          {y._count && (y._count.classes > 0 || y._count.invoices > 0 || y._count.attendance > 0) && (
                            <span className="text-[11px] text-slate-400">
                              {y._count.classes} class(es) · {y._count.invoices} invoice(s) · {y._count.attendance} attendance
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 self-start">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                              y.status === 'Inactive'
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {y.status === 'Inactive' ? 'Inactive' : 'Active'}
                          </span>
                          {can('academic_years', 'edit') && (
                              <button
                              onClick={() => openEditYearModal(y)}
                              className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition text-base"
                              title="Edit academic year"
                            >
                              ✏️
                            </button>
                          )}
                          {can('academic_years', 'delete') && (
                              <button
                              onClick={() => openDeleteYearModal(y)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-base"
                              title="Delete academic year"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* TAB: PERFORMANCE */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* Notice alert */}
              {performanceNotice && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span>{performanceNotice}</span>
                  </div>
                  <button
                    onClick={() => setPerformanceNotice('')}
                    className="text-emerald-500 hover:text-emerald-700 font-bold ml-2"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    📈 Student Performance <span className="ml-2 text-base font-normal text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{performanceList.length}</span>
                  </h1>
                  <p className="text-sm text-slate-500">Terminal and continuous assessment records, WAEC/GES 9-point grading scale, and rankings.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {can('performance', 'create') && (
                      <button
                      onClick={openAddPerformanceModal}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
                    >
                      + Add Performance Record
                    </button>
                  )}
                  <button
                    onClick={() => setShowBulkPerformanceModal(true)}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
                  >
                    🧮 Advanced Record Entry
                  </button>
                  <button
                    onClick={() => setShowImportPerformanceModal(true)}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
                  >
                    📥 Import Performance
                  </button>
                  <button
                    onClick={() => setShowTerminalReportModal(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
                  >
                    📋 Terminal Report
                  </button>
                </div>
              </div>

              {/* Metric Cards */}
              {(() => {
                const totalRecords = performanceList.length;
                const avgScore = totalRecords > 0
                  ? (performanceList.reduce((acc, p) => acc + (Number(p.total) || 0), 0) / totalRecords).toFixed(1)
                  : '0.0';
                const distinctionCount = performanceList.filter((p) => (Number(p.total) || 0) >= 70).length;
                const distinctionRate = totalRecords > 0 ? Math.round((distinctionCount / totalRecords) * 100) : 0;
                const passCount = performanceList.filter((p) => (Number(p.total) || 0) >= 50).length;
                const passRate = totalRecords > 0 ? Math.round((passCount / totalRecords) * 100) : 0;

                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
                        📊
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-slate-900">{totalRecords}</div>
                        <div className="text-[11px] text-slate-500 font-medium">Total Assessments</div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                        🎯
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-slate-900">{avgScore}%</div>
                        <div className="text-[11px] text-slate-500 font-medium">Average Score (100%)</div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
                        🌟
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-slate-900">{distinctionCount}</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Distinctions &ge; 70% ({distinctionRate}%)
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
                        📈
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-slate-900">{passRate}%</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Pass Rate &ge; 50% ({passCount} pupils)
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Filters toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Search */}
                  <div className="lg:col-span-2">
                    <input
                      type="text"
                      placeholder="Search student, ID, subject, PRF ID, grade..."
                      value={performanceSearchQuery}
                      onChange={(e) => setPerformanceSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                    />
                  </div>

                  {/* Class Filter */}
                  <div>
                    <select
                      value={performanceClassFilter}
                      onChange={(e) => setPerformanceClassFilter(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Classes</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Academic Year Filter */}
                  <div>
                    <select
                      value={performanceYearFilter}
                      onChange={(e) => setPerformanceYearFilter(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Academic Years</option>
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.year}>
                          {y.year} {y.status === 'ACTIVE' || y.status === 'Active' ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Term Filter */}
                  <div>
                    <select
                      value={performanceTermFilter}
                      onChange={(e) => setPerformanceTermFilter(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Terms</option>
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                  </div>
                </div>

                {/* Sub-toolbar row: Subject filter + Reset */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Subject:</span>
                    <select
                      value={performanceSubjectFilter}
                      onChange={(e) => setPerformanceSubjectFilter(e.target.value)}
                      className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(performanceSearchQuery ||
                    performanceClassFilter ||
                    performanceYearFilter ||
                    performanceTermFilter ||
                    performanceSubjectFilter) && (
                    <button
                      onClick={() => {
                        setPerformanceSearchQuery('');
                        setPerformanceClassFilter('');
                        setPerformanceYearFilter('');
                        setPerformanceTermFilter('');
                        setPerformanceSubjectFilter('');
                      }}
                      className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Performance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {filteredPerformance.length} {filteredPerformance.length === 1 ? 'Assessment Record' : 'Assessment Records'}
                  </span>
                  <button
                    onClick={fetchPerformance}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {performanceLoading ? 'Refreshing...' : '↻ Refresh'}
                  </button>
                </div>

                {performanceLoading && performanceList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    <div className="inline-block animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                    <p>Loading performance records...</p>
                  </div>
                ) : filteredPerformance.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-3">
                    <p className="text-base font-semibold text-slate-700">No performance records found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {performanceSearchQuery || performanceClassFilter || performanceYearFilter || performanceTermFilter || performanceSubjectFilter
                        ? 'No records match your active search filters. Try adjusting your filters above.'
                        : 'No student exam scores or assessments have been recorded yet. Click "+ Add Assessment Record" to get started.'}
                    </p>
                    {!performanceSearchQuery && !performanceClassFilter && can('performance', 'create') && (
                      <button
                        onClick={openAddPerformanceModal}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
                      >
                        + Add First Assessment Record
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/60 font-semibold">
                          <th className="py-3 px-4">Ref / ID</th>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Class</th>
                          <th className="py-3 px-4">Course / Subject</th>
                          <th className="py-3 px-4">Session & Term</th>
                          <th className="py-3 px-4 text-center">Class (50%)</th>
                          <th className="py-3 px-4 text-center">Exam (100%)</th>
                          <th className="py-3 px-4 text-center">Exam (50%)</th>
                          <th className="py-3 px-4 text-center font-bold">Total (100%)</th>
                          <th className="py-3 px-4 text-center">Grade</th>
                          <th className="py-3 px-4 text-center">Rank</th>
                          <th className="py-3 px-4">Remarks</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredPerformance.map((p) => {
                          const studentFullName = p.student
                            ? `${p.student.firstName} ${p.student.lastName}`
                            : (p.studentName || 'Unknown Student');
                          const studentCode = p.student?.studentId || '';
                          const totalVal = Number(p.total) || 0;
                          const gradeVal = p.grade ? String(p.grade).trim() : '';

                          let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                          if (gradeVal === '1' || gradeVal === '2') {
                            badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
                          } else if (['3', '4', '5', '6'].includes(gradeVal)) {
                            badgeClass = 'bg-blue-100 text-blue-800 border-blue-200 font-semibold';
                          } else if (gradeVal === '7' || gradeVal === '8') {
                            badgeClass = 'bg-amber-100 text-amber-800 border-amber-200 font-medium';
                          } else if (gradeVal === '9') {
                            badgeClass = 'bg-red-100 text-red-800 border-red-200 font-bold';
                          }

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-4 font-mono font-medium text-slate-500">
                                {p.performanceId || <span className="text-slate-300 italic">-</span>}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">{studentFullName}</div>
                                {studentCode && (
                                  <div className="text-[11px] text-slate-400 font-mono">{studentCode}</div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                                  {p.studentClass || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-900">
                                {p.course}
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                <div>{p.academicYear}</div>
                                <div className="text-[11px] text-slate-400">{p.term}</div>
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                                {Number(p.classScore).toFixed(1)}
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-slate-500">
                                {Number(p.examScore100).toFixed(1)}
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-slate-600">
                                {Number(p.examScore60).toFixed(1)}
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                                <span className={totalVal >= 70 ? 'text-emerald-700' : totalVal < 50 ? 'text-red-600' : 'text-slate-800'}>
                                  {totalVal.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs border ${badgeClass}`}>
                                  Grade {gradeVal || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-semibold text-slate-800">
                                {p.rank ? (
                                  <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-xs font-mono font-bold text-slate-700">
                                    #{p.rank}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {p.remarks || '-'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {can('performance', 'edit') && (
                                      <button
                                      onClick={() => openEditPerformanceModal(p)}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition"
                                      title="Edit record"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                  {can('performance', 'delete') && (
                                      <button
                                      onClick={() => openDeletePerformanceModal(p)}
                                      className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition"
                                      title="Delete record"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── BULK / ADVANCED RECORD ENTRY MODAL ── */}
              {showBulkPerformanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">🧮 Advanced Record Entry</h3>
                        <p className="text-xs text-slate-500">Select year, class, term, and subject — all students load automatically. Existing scores are pre-filled.</p>
                      </div>
                      <button onClick={() => { setShowBulkPerformanceModal(false); setBulkStudents([]); setBulkNotice(''); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                    </div>
                    <div className="p-6 space-y-5 overflow-y-auto flex-1">
                      {/* Info banner */}
                      <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-3 rounded-xl">
                        Select the academic year, class, term, and subject. All students in the class will appear below. Existing records will be pre-filled and updated when saved.
                      </div>
                      {/* Filter row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Academic Year *</label>
                          <select value={bulkYear} onChange={(e) => setBulkYear(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Select Year --</option>
                            {academicYears.map((y) => <option key={y.id} value={y.year}>{y.year}{y.status === 'Active' || y.status === 'ACTIVE' ? ' (Active)' : ''}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Class *</label>
                          <select value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Select Class --</option>
                            {classesList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Term *</label>
                          <select value={bulkTerm} onChange={(e) => setBulkTerm(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="Term 1">Term 1</option>
                            <option value="Term 2">Term 2</option>
                            <option value="Term 3">Term 3</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Course / Subject *</label>
                          <input type="text" list="bulk-subject-list" value={bulkCourse} onChange={(e) => setBulkCourse(e.target.value)} placeholder="e.g. Mathematics" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <datalist id="bulk-subject-list">{subjects.map((s) => <option key={s.id} value={s.name} />)}</datalist>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{bulkStudents.length > 0 ? `${bulkStudents.length} students loaded` : 'Select all filters then click Load Students'}</span>
                        <button onClick={loadBulkGrid} disabled={!bulkYear || !bulkClassId || !bulkTerm || !bulkCourse || bulkGridLoading} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50">
                          {bulkGridLoading ? '⏳ Loading…' : '🔄 Load Students'}
                        </button>
                      </div>
                      {bulkNotice && <div className={`text-xs px-4 py-3 rounded-xl border ${bulkNotice.startsWith('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>{bulkNotice}</div>}
                      {/* Grid */}
                      {bulkStudents.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-auto max-h-[44vh]">
                          <table className="w-full text-xs border-collapse">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                              <tr>
                                <th className="py-3 px-4 text-left font-semibold text-slate-500 uppercase">Student</th>
                                <th className="py-3 px-4 text-left font-semibold text-slate-500 uppercase">ID</th>
                                <th className="py-3 px-4 font-semibold text-slate-500 uppercase text-center">Class Score (max 50)</th>
                                <th className="py-3 px-4 font-semibold text-slate-500 uppercase text-center">Exam Score (out of 100)</th>
                                <th className="py-3 px-4 font-semibold text-slate-500 uppercase text-center bg-slate-100">Exam (50%)</th>
                                <th className="py-3 px-4 font-semibold text-slate-500 uppercase text-center bg-slate-100">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {bulkStudents.map((s, idx) => (
                                <tr key={s.id} className="hover:bg-slate-50/80">
                                  <td className="py-2.5 px-4 font-semibold text-slate-900">{s.firstName} {s.lastName}</td>
                                  <td className="py-2.5 px-4 text-slate-500 font-mono">{s.studentId}</td>
                                  <td className="py-2.5 px-4 text-center">
                                    <input type="number" min="0" max="50" step="0.1" value={s.classScore} onChange={(e) => updateBulkRow(idx, 'classScore', e.target.value)} className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" placeholder="0–50" />
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <input type="number" min="0" max="100" step="0.1" value={s.examScore100} onChange={(e) => updateBulkRow(idx, 'examScore100', e.target.value)} className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" placeholder="0–100" />
                                  </td>
                                  <td className="py-2.5 px-4 text-center bg-slate-50 font-mono text-slate-600">{s.examScore50 || '—'}</td>
                                  <td className="py-2.5 px-4 text-center bg-slate-50 font-mono font-bold text-slate-900">{s.total || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => { setShowBulkPerformanceModal(false); setBulkStudents([]); setBulkNotice(''); }} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition">Cancel</button>
                      <button onClick={saveBulkPerformance} disabled={bulkSaveLoading || bulkStudents.length === 0} className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold transition disabled:opacity-50">
                        {bulkSaveLoading ? '⏳ Saving…' : '💾 Save All Records'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── IMPORT PERFORMANCE CSV MODAL ── */}
              {showImportPerformanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">📥 Import Performance from CSV</h3>
                      <button onClick={() => { setShowImportPerformanceModal(false); setCsvPerfRows([]); setCsvImportNotice(''); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                    </div>
                    <div className="p-6 space-y-5 overflow-y-auto flex-1">
                      {/* Format info */}
                      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs text-violet-800 space-y-2">
                        <p className="font-bold">CSV Format — columns required in order:</p>
                        <code className="block bg-white rounded px-3 py-1.5 border border-violet-200 text-violet-900 text-[11px]">
                          Student ID, Student Name, Class, Term, Academic Year, Course, Class Score, Exam Score (100)
                        </code>
                        <p className="font-semibold mt-1">Example:</p>
                        <code className="block bg-white rounded px-3 py-1.5 border border-violet-200 text-violet-900 text-[11px]">
                          STU-1001,John Doe,Grade 5,Term 1,2024/2025,Mathematics,42,78
                        </code>
                        <div className="flex gap-2 pt-1">
                          <button onClick={downloadCsvTemplate} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition">📄 Blank Template</button>
                          <button onClick={downloadCsvSample} className="px-3 py-1.5 rounded-lg bg-violet-800 hover:bg-violet-900 text-white text-xs font-semibold transition">🧾 Sample with Data</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Upload CSV File</label>
                        <input type="file" accept=".csv" onChange={(e) => { if (e.target.files?.[0]) parseCsvFile(e.target.files[0]); }} className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50" />
                      </div>
                      {csvImportNotice && <div className={`text-xs px-4 py-3 rounded-xl border ${csvImportNotice.startsWith('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>{csvImportNotice}</div>}
                      {/* Preview */}
                      {csvPerfRows.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Preview (first 5 rows)</p>
                          <div className="border border-slate-200 rounded-xl overflow-auto max-h-52">
                            <table className="w-full text-[11px] border-collapse">
                              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                <tr>{['Row','Student ID','Name','Class','Term','Year','Course','Class Score','Exam (100)'].map((h) => <th key={h} className="py-2 px-3 text-left text-slate-500 font-semibold whitespace-nowrap">{h}</th>)}</tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {csvPerfRows.slice(0, 5).map((r, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                                    <td className="py-2 px-3 font-mono">{r.studentId}</td>
                                    <td className="py-2 px-3">{r.studentName}</td>
                                    <td className="py-2 px-3">{r.studentClass}</td>
                                    <td className="py-2 px-3">{r.term}</td>
                                    <td className="py-2 px-3">{r.academicYear}</td>
                                    <td className="py-2 px-3">{r.course}</td>
                                    <td className="py-2 px-3 text-center font-mono">{r.classScore}</td>
                                    <td className="py-2 px-3 text-center font-mono">{r.examScore100}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Total: {csvPerfRows.length} rows to import</p>
                        </div>
                      )}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => { setShowImportPerformanceModal(false); setCsvPerfRows([]); setCsvImportNotice(''); }} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition">Cancel</button>
                      <button onClick={importCsvPerformance} disabled={csvImportLoading || csvPerfRows.length === 0} className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition disabled:opacity-50">
                        {csvImportLoading ? '⏳ Importing…' : `📥 Import ${csvPerfRows.length} Records`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TERMINAL REPORT GENERATOR MODAL ── */}
              {showTerminalReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">📋 Terminal Report Generator</h3>
                      <button onClick={() => { setShowTerminalReportModal(false); setTermReportStudents([]); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Class *</label>
                          <select value={termReportClass} onChange={(e) => { setTermReportClass(e.target.value); setTermReportStudents([]); }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Select Class --</option>
                            {classesList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Term *</label>
                          <select value={termReportTerm} onChange={(e) => setTermReportTerm(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="Term 1">Term 1</option>
                            <option value="Term 2">Term 2</option>
                            <option value="Term 3">Term 3</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Academic Year <span className="text-blue-500 font-normal normal-case">(Auto-selected if active)</span></label>
                        <select value={termReportYear} onChange={(e) => setTermReportYear(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">-- Select Year --</option>
                          {academicYears.map((y) => <option key={y.id} value={y.year}>{y.year}{y.status === 'Active' || y.status === 'ACTIVE' ? ' (Active)' : ''}</option>)}
                        </select>
                      </div>
                      <button onClick={loadTermReportStudents} disabled={!termReportClass || termReportLoading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50 w-full">
                        {termReportLoading ? '⏳ Loading Students…' : '👥 Load Students in Class'}
                      </button>
                      {/* Student list */}
                      {termReportStudents.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600">{termReportStudents.length} students</span>
                            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                              <input type="checkbox" checked={termReportStudents.every((s) => s.selected)} onChange={(e) => setTermReportStudents((prev) => prev.map((s) => ({ ...s, selected: e.target.checked })))} className="rounded" />
                              Select All
                            </label>
                          </div>
                          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                            {termReportStudents.map((s) => (
                              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
                                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                                  <input type="checkbox" checked={s.selected} onChange={(e) => setTermReportStudents((prev) => prev.map((x) => x.id === s.id ? { ...x, selected: e.target.checked } : x))} className="rounded" />
                                  <span className="text-sm font-medium text-slate-900">{s.name}</span>
                                  <span className="text-xs text-slate-400 font-mono">{s.studentId}</span>
                                </label>
                                <button onClick={() => generateTerminalReport(s.id)} disabled={!termReportYear || !termReportTerm} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-40">
                                  🖨️ Print
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {termReportStudents.length === 0 && termReportClass && !termReportLoading && (
                        <p className="text-xs text-slate-400 text-center py-4">Click "Load Students" to see the class list.</p>
                      )}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => { setShowTerminalReportModal(false); setTermReportStudents([]); }} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition">Close</button>
                      <button
                        onClick={() => termReportStudents.filter((s) => s.selected).forEach((s) => generateTerminalReport(s.id))}
                        disabled={termReportStudents.filter((s) => s.selected).length === 0 || !termReportYear}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50"
                      >
                        🖨️ Print Selected ({termReportStudents.filter((s) => s.selected).length})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ADD PERFORMANCE MODAL */}
              {showAddPerformanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Add Performance Record</h3>
                        <p className="text-xs text-slate-500">Record assessment score, terminal exam, and compute WAEC grade.</p>
                      </div>
                      <button
                        onClick={() => setShowAddPerformanceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handlePerformanceFormSubmit} className="flex flex-col flex-1 overflow-hidden">
                      <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {performanceFormError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                            {performanceFormError}
                          </div>
                        )}

                        {/* Class and Student selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Class *
                            </label>
                            <select
                              required
                              value={perfSelectedClassId}
                              onChange={(e) => handleClassSelectForPerformance(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Class --</option>
                              {classesList.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Student *
                            </label>
                            <select
                              required
                              value={performanceForm.studentId}
                              onChange={(e) => setPerformanceForm({ ...performanceForm, studentId: e.target.value })}
                              disabled={!perfSelectedClassId || perfClassStudentsLoading}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">
                                {perfClassStudentsLoading
                                  ? 'Loading students...'
                                  : !perfSelectedClassId
                                  ? '-- Select Class First --'
                                  : perfClassStudents.length === 0
                                  ? 'No students enrolled in class'
                                  : '-- Select Student --'}
                              </option>
                              {perfClassStudents.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.firstName} {s.lastName} ({s.studentId})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Course & Session */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Course / Subject *
                            </label>
                            <input
                              type="text"
                              required
                              list="perf-subject-suggestions"
                              placeholder="e.g. Mathematics"
                              value={performanceForm.course}
                              onChange={(e) => setPerformanceForm({ ...performanceForm, course: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <datalist id="perf-subject-suggestions">
                              {subjects.map((s) => (
                                <option key={s.id} value={s.name} />
                              ))}
                            </datalist>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Academic Year *
                            </label>
                            <select
                              required
                              value={performanceForm.academicYear}
                              onChange={(e) => setPerformanceForm({ ...performanceForm, academicYear: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Year --</option>
                              {academicYears.map((y) => (
                                <option key={y.id} value={y.year}>
                                  {y.year} {y.status === 'ACTIVE' || y.status === 'Active' ? '(Active)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Term *
                            </label>
                            <select
                              required
                              value={performanceForm.term}
                              onChange={(e) => setPerformanceForm({ ...performanceForm, term: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                            </select>
                          </div>
                        </div>

                        {/* Scores input */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Class Assessment (Max 50) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="50"
                              step="0.1"
                              placeholder="0 - 50"
                              value={performanceForm.classScore}
                              onChange={(e) => setPerformanceForm({ ...performanceForm, classScore: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <span className="text-[10px] text-slate-400">Continuous Assessment: 50% max</span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Terminal Exam (Raw 100%) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="100"
                              step="0.1"
                              placeholder="0 - 100"
                              value={performanceForm.examScore100}
                              onChange={(e) => setPerformanceForm({ ...performanceForm, examScore100: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <span className="text-[10px] text-slate-400">Exam score weighted at 50%</span>
                          </div>
                        </div>

                        {/* Live Score Preview Card */}
                        {(() => {
                          const preview = computeScorePreview(performanceForm.classScore, performanceForm.examScore100);
                          return (
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center gap-4 text-xs font-mono">
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Class 50%</span>
                                  <span className="font-bold text-slate-800">{preview.classScore.toFixed(1)}</span>
                                </div>
                                <span className="text-slate-300 font-sans">+</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Exam 50%</span>
                                  <span className="font-bold text-slate-800">{preview.examScore50.toFixed(1)}</span>
                                </div>
                                <span className="text-slate-300 font-sans">=</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Total 100%</span>
                                  <span className="font-extrabold text-blue-700 text-sm">{preview.total.toFixed(1)}%</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  Grade {preview.grade}
                                </span>
                                <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                  {preview.remarks}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowAddPerformanceModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={performanceFormLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {performanceFormLoading ? 'Saving...' : 'Save Performance Record'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* EDIT PERFORMANCE MODAL */}
              {showEditPerformanceModal && editingPerformance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Edit Performance Record</h3>
                        <p className="text-xs text-slate-500">
                          {editingPerformance.performanceId || 'Record'} · {editingPerformance.student ? `${editingPerformance.student.firstName} ${editingPerformance.student.lastName}` : (editingPerformance.studentName || 'Student')}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowEditPerformanceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleEditPerformanceSubmit} className="flex flex-col flex-1 overflow-hidden">
                      <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {editPerformanceError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                            {editPerformanceError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Student Name (Read Only)
                            </label>
                            <input
                              type="text"
                              disabled
                              value={
                                editingPerformance.student
                                  ? `${editingPerformance.student.firstName} ${editingPerformance.student.lastName} (${editingPerformance.student.studentId})`
                                  : (editingPerformance.studentName || '')
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-100 text-slate-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Class
                            </label>
                            <select
                              value={editPerformanceForm.studentClass}
                              onChange={(e) => setEditPerformanceForm({ ...editPerformanceForm, studentClass: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Class --</option>
                              {classesList.map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Course / Subject *
                            </label>
                            <input
                              type="text"
                              required
                              list="edit-perf-subject-suggestions"
                              value={editPerformanceForm.course}
                              onChange={(e) => setEditPerformanceForm({ ...editPerformanceForm, course: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <datalist id="edit-perf-subject-suggestions">
                              {subjects.map((s) => (
                                <option key={s.id} value={s.name} />
                              ))}
                            </datalist>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Academic Year *
                            </label>
                            <select
                              required
                              value={editPerformanceForm.academicYear}
                              onChange={(e) => setEditPerformanceForm({ ...editPerformanceForm, academicYear: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Year --</option>
                              {academicYears.map((y) => (
                                <option key={y.id} value={y.year}>
                                  {y.year} {y.status === 'ACTIVE' || y.status === 'Active' ? '(Active)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Term *
                            </label>
                            <select
                              required
                              value={editPerformanceForm.term}
                              onChange={(e) => setEditPerformanceForm({ ...editPerformanceForm, term: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                            </select>
                          </div>
                        </div>

                        {/* Scores input */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Class Assessment (Max 50) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="50"
                              step="0.1"
                              value={editPerformanceForm.classScore}
                              onChange={(e) => setEditPerformanceForm({ ...editPerformanceForm, classScore: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <span className="text-[10px] text-slate-400">Continuous Assessment: 50% max</span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Terminal Exam (Raw 100%) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              max="100"
                              step="0.1"
                              value={editPerformanceForm.examScore100}
                              onChange={(e) => setEditPerformanceForm({ ...editPerformanceForm, examScore100: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <span className="text-[10px] text-slate-400">Exam score weighted at 50%</span>
                          </div>
                        </div>

                        {/* Live Score Preview Card */}
                        {(() => {
                          const preview = computeScorePreview(editPerformanceForm.classScore, editPerformanceForm.examScore100);
                          return (
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center gap-4 text-xs font-mono">
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Class 50%</span>
                                  <span className="font-bold text-slate-800">{preview.classScore.toFixed(1)}</span>
                                </div>
                                <span className="text-slate-300 font-sans">+</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Exam 50%</span>
                                  <span className="font-bold text-slate-800">{preview.examScore50.toFixed(1)}</span>
                                </div>
                                <span className="text-slate-300 font-sans">=</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Total 100%</span>
                                  <span className="font-extrabold text-blue-700 text-sm">{preview.total.toFixed(1)}%</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  Grade {preview.grade}
                                </span>
                                <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                  {preview.remarks}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowEditPerformanceModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editPerformanceLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {editPerformanceLoading ? 'Updating...' : 'Update Performance Record'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE PERFORMANCE MODAL */}
              {showDeletePerformanceModal && deletingPerformance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>⚠️</span> Delete Performance Record
                      </h3>
                      <button
                        onClick={() => setShowDeletePerformanceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5 space-y-2">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete the performance record for{' '}
                        <strong className="text-slate-900">
                          {deletingPerformance.student
                            ? `${deletingPerformance.student.firstName} ${deletingPerformance.student.lastName}`
                            : (deletingPerformance.studentName || 'Student')}
                        </strong>{' '}
                        in <strong className="text-slate-900">{deletingPerformance.course}</strong> ({deletingPerformance.term}, {deletingPerformance.academicYear})?
                      </p>
                      <p className="text-xs text-red-500">
                        This action will remove the assessment from terminal grading and report cards.
                      </p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeletePerformanceModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeletePerformance}
                        disabled={deletePerformanceLoading}
                        className="px-5 py-2 rounded-xl bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {deletePerformanceLoading ? 'Deleting...' : 'Delete Record'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: INVOICES */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              {/* Notice alert */}
              {invoiceNotice && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span>{invoiceNotice}</span>
                  </div>
                  <button
                    onClick={() => setInvoiceNotice('')}
                    className="text-emerald-500 hover:text-emerald-700 font-bold ml-2"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Student Invoices & Billing</h1>
                  <p className="text-sm text-slate-500">
                    Issue student fee bills, track paid collections, outstanding balances, and due dates.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={openBulkInvoiceModal}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
                  >
                    <span>⚡</span> Generate Class Invoices
                  </button>
                  {can('invoices', 'create') && (
                      <button
                      onClick={openAddInvoiceModal}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
                    >
                      <span>+</span> Create Invoice
                    </button>
                  )}
                </div>
              </div>

              {/* Metric Cards */}
              {(() => {
                const totalInvoices = invoicesList.length;
                const totalBilled = invoicesList.reduce((acc, inv) => acc + (Number(inv.totalAmount) || 0), 0);
                const totalCollected = invoicesList.reduce((acc, inv) => acc + (Number(inv.paidAmount) || 0), 0);
                const totalBalance = invoicesList.reduce((acc, inv) => acc + (Number(inv.balance) || 0), 0);

                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
                        🧾
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-slate-900">{totalInvoices}</div>
                        <div className="text-[11px] text-slate-500 font-medium">Total Invoices</div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
                        💰
                      </div>
                      <div>
                        <div className="text-xl font-extrabold text-slate-900">
                          GHS {totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">Total Billed</div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                        💳
                      </div>
                      <div>
                        <div className="text-xl font-extrabold text-emerald-700">
                          GHS {totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">Total Collected</div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
                        ⏳
                      </div>
                      <div>
                        <div className="text-xl font-extrabold text-amber-700">
                          GHS {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">Outstanding Balance</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Filters toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Search */}
                  <div className="lg:col-span-2">
                    <input
                      type="text"
                      placeholder="Search ID, student, class, category, status..."
                      value={invoiceSearchQuery}
                      onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                    />
                  </div>

                  {/* Academic Year Filter */}
                  <div>
                    <select
                      value={invoiceYearFilter}
                      onChange={(e) => setInvoiceYearFilter(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Academic Years</option>
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.year} {y.status === 'ACTIVE' || y.status === 'Active' ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Term Filter */}
                  <div>
                    <select
                      value={invoiceTermFilter}
                      onChange={(e) => setInvoiceTermFilter(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Terms</option>
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <select
                      value={invoiceStatusFilter}
                      onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Statuses</option>
                      <option value="PAID">Paid</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="UNPAID">Unpaid</option>
                      <option value="OVERDUE">Overdue</option>
                    </select>
                  </div>
                </div>

                {/* Sub-toolbar row: Class filter + Reset */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Class:</span>
                    <select
                      value={invoiceClassFilter}
                      onChange={(e) => setInvoiceClassFilter(e.target.value)}
                      className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Classes</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(invoiceSearchQuery ||
                    invoiceYearFilter ||
                    invoiceTermFilter ||
                    invoiceStatusFilter ||
                    invoiceClassFilter) && (
                    <button
                      onClick={() => {
                        setInvoiceSearchQuery('');
                        setInvoiceYearFilter('');
                        setInvoiceTermFilter('');
                        setInvoiceStatusFilter('');
                        setInvoiceClassFilter('');
                      }}
                      className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Invoices Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {filteredInvoices.length} {filteredInvoices.length === 1 ? 'Invoice' : 'Invoices'}
                  </span>
                  <button
                    onClick={fetchInvoices}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {invoicesLoading ? 'Refreshing...' : '↻ Refresh'}
                  </button>
                </div>

                {invoicesLoading && invoicesList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    <div className="inline-block animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                    <p>Loading invoices...</p>
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-3">
                    <p className="text-base font-semibold text-slate-700">No invoices found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {invoiceSearchQuery || invoiceYearFilter || invoiceTermFilter || invoiceStatusFilter || invoiceClassFilter
                        ? 'No records match your active search filters. Try adjusting your filters above.'
                        : 'No student fee invoices have been generated yet. Click "+ Create Invoice" or "⚡ Generate Class Invoices" to start.'}
                    </p>
                    {!invoiceSearchQuery && !invoiceClassFilter && (
                      <div className="flex justify-center gap-3 pt-1">
                        {can('invoices', 'create') && (
                            <button
                            onClick={openAddInvoiceModal}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
                          >
                            + Create First Invoice
                          </button>
                        )}
                        <button
                          onClick={openBulkInvoiceModal}
                          className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
                        >
                          ⚡ Generate for Class
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/60 font-semibold">
                          <th className="py-3 px-4">Invoice ID</th>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Class</th>
                          <th className="py-3 px-4">Category & Items</th>
                          <th className="py-3 px-4">Academic Year & Term</th>
                          <th className="py-3 px-4">Issue Date</th>
                          <th className="py-3 px-4">Due Date</th>
                          <th className="py-3 px-4 text-right">Amount (GHS)</th>
                          <th className="py-3 px-4 text-right">Paid (GHS)</th>
                          <th className="py-3 px-4 text-right font-bold">Balance (GHS)</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredInvoices.map((inv) => {
                          const studentFullName = inv.student
                            ? `${inv.student.firstName} ${inv.student.lastName}`
                            : 'Unknown Student';
                          const studentCode = inv.student?.studentId || '';
                          const className = inv.student?.class?.name || '-';

                          let statusBadge = (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                              Unpaid
                            </span>
                          );
                          if (inv.status === 'PAID') {
                            statusBadge = (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Paid
                              </span>
                            );
                          } else if (inv.status === 'PARTIAL') {
                            statusBadge = (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                Partial
                              </span>
                            );
                          } else if (inv.isOverdue) {
                            statusBadge = (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white shadow-xs">
                                Overdue
                              </span>
                            );
                          } else if (inv.status === 'CANCELLED') {
                            statusBadge = (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                Cancelled
                              </span>
                            );
                          }

                          return (
                            <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-4 font-mono font-bold text-blue-600">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">{studentFullName}</div>
                                {studentCode && (
                                  <div className="text-[11px] text-slate-400 font-mono">{studentCode}</div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                                  {className}
                                </span>
                              </td>
                              <td className="py-3 px-4 max-w-xs">
                                <div className="font-semibold text-slate-800">{inv.category || 'Tuition'}</div>
                                {inv.items && (
                                  <div className="text-[11px] text-slate-400 truncate">{inv.items}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                <div>{inv.academicYear?.year || '-'}</div>
                                <div className="text-[11px] text-slate-400">{inv.term}</div>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {inv.issueDate || '-'}
                              </td>
                              <td className="py-3 px-4 font-mono">
                                <span className={inv.isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}>
                                  {inv.dueDate || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                                {Number(inv.totalAmount).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-emerald-600 font-medium">
                                {Number(inv.paidAmount).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                <span className={inv.balance > 0 ? 'text-red-700' : 'text-slate-500'}>
                                  {Number(inv.balance).toFixed(2)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {statusBadge}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {can('invoices', 'edit') && (
                                      <button
                                      onClick={() => openEditInvoiceModal(inv)}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition"
                                      title="Edit invoice"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                  {can('invoices', 'delete') && (
                                      <button
                                      onClick={() => openDeleteInvoiceModal(inv)}
                                      className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition"
                                      title="Delete invoice"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* CREATE SINGLE INVOICE MODAL */}
              {showAddInvoiceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Create Student Invoice</h3>
                        <p className="text-xs text-slate-500">Generate a new termly bill for a student.</p>
                      </div>
                      <button
                        onClick={() => setShowAddInvoiceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleInvoiceFormSubmit} className="flex flex-col flex-1 overflow-hidden">
                      <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {invoiceFormError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                            {invoiceFormError}
                          </div>
                        )}

                        {/* Class Filter & Student Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Class (To Filter Students)
                            </label>
                            <select
                              value={invSelectedClassId}
                              onChange={(e) => handleClassSelectForInvoice(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Class --</option>
                              {classesList.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Student *
                            </label>
                            <select
                              required
                              value={invoiceForm.studentId}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })}
                              disabled={!invSelectedClassId || invClassStudentsLoading}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">
                                {invClassStudentsLoading
                                  ? 'Loading pupils...'
                                  : !invSelectedClassId
                                  ? '-- Select Class First --'
                                  : invClassStudents.length === 0
                                  ? 'No students enrolled in class'
                                  : '-- Select Student --'}
                              </option>
                              {invClassStudents.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.firstName} {s.lastName} ({s.studentId})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Session, Term & Category */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Academic Year *
                            </label>
                            <select
                              required
                              value={invoiceForm.academicYearId}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, academicYearId: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Year --</option>
                              {academicYears.map((y) => (
                                <option key={y.id} value={y.id}>
                                  {y.year} {y.status === 'ACTIVE' || y.status === 'Active' ? '(Active)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Term *
                            </label>
                            <select
                              required
                              value={invoiceForm.term}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, term: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Fee Category *
                            </label>
                            <select
                              required
                              value={invoiceForm.category}
                              onChange={(e) => {
                                const selectedCatName = e.target.value;
                                const matchedCat = billingCategories.find((bc) => bc.name === selectedCatName);
                                setInvoiceForm((prev) => ({
                                  ...prev,
                                  category: selectedCatName,
                                  totalAmount: matchedCat ? String(matchedCat.totalAmount) : prev.totalAmount,
                                  items: matchedCat?.items || prev.items,
                                }));
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="Tuition">Tuition</option>
                              <option value="Lab Fee">Lab Fee</option>
                              <option value="Sports">Sports</option>
                              <option value="Transportation">Transportation</option>
                              <option value="Books">Books</option>
                              <option value="Uniform">Uniform</option>
                              <option value="Examination">Examination</option>
                              <option value="PTA Levy">PTA Levy</option>
                              <option value="Boarding">Boarding</option>
                              <option value="Other">Other</option>
                              {billingCategories
                                .filter((bc) => !['Tuition', 'Lab Fee', 'Sports', 'Transportation', 'Books', 'Uniform', 'Examination', 'PTA Levy', 'Boarding', 'Other'].includes(bc.name))
                                .map((bc) => (
                                  <option key={bc.id} value={bc.name}>
                                    {bc.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Description / Itemized breakdown */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                            Fee Items / Description
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Tuition (GHS 400), Library & ICT (GHS 100)"
                            value={invoiceForm.items}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, items: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Amounts & Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Total Amount Due (GHS) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0.01"
                              step="0.01"
                              placeholder="0.00"
                              value={invoiceForm.totalAmount}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, totalAmount: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Initial Paid Amount (GHS)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={invoiceForm.paidAmount}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, paidAmount: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Issue Date
                            </label>
                            <input
                              type="date"
                              value={invoiceForm.issueDate}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Payment Due Date
                            </label>
                            <input
                              type="date"
                              value={invoiceForm.dueDate}
                              onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>

                        {/* Live Balance Preview */}
                        {(() => {
                          const tot = parseFloat(invoiceForm.totalAmount) || 0;
                          const paid = parseFloat(invoiceForm.paidAmount) || 0;
                          const bal = Math.max(0, tot - paid);
                          let statusLabel = 'Unpaid';
                          let badgeBg = 'bg-red-100 text-red-800 border-red-200';
                          if (bal <= 0 && tot > 0) {
                            statusLabel = 'Paid in Full';
                            badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                          } else if (paid > 0 && bal > 0) {
                            statusLabel = 'Partial Payment';
                            badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
                          }

                          return (
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center gap-4 text-xs font-mono">
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Total Billed</span>
                                  <span className="font-bold text-slate-800">GHS {tot.toFixed(2)}</span>
                                </div>
                                <span className="text-slate-300 font-sans">-</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Paid Amount</span>
                                  <span className="font-bold text-emerald-600">GHS {paid.toFixed(2)}</span>
                                </div>
                                <span className="text-slate-300 font-sans">=</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Remaining Balance</span>
                                  <span className="font-extrabold text-blue-700 text-sm">GHS {bal.toFixed(2)}</span>
                                </div>
                              </div>

                              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeBg}`}>
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowAddInvoiceModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={invoiceFormLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {invoiceFormLoading ? 'Generating...' : 'Issue Invoice'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* BATCH GENERATE CLASS INVOICES MODAL */}
              {showBulkInvoiceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Generate Class Invoices</h3>
                        <p className="text-xs text-slate-500">Batch-generate invoices for all enrolled pupils in a class.</p>
                      </div>
                      <button
                        onClick={() => setShowBulkInvoiceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleBulkInvoiceSubmit} className="flex flex-col flex-1 overflow-hidden">
                      <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {bulkInvError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                            {bulkInvError}
                          </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 leading-relaxed">
                          💡 <strong>Batch Automation:</strong> This will create individual invoices for every active pupil enrolled in the selected class. Students who already have an invoice for this category and term will be skipped automatically.
                        </div>

                        {/* Class & Academic Session */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Target Class *
                            </label>
                            <select
                              required
                              value={bulkInvForm.classId}
                              onChange={(e) => setBulkInvForm({ ...bulkInvForm, classId: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Class --</option>
                              {classesList.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c._count?.students || 0} students)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Academic Year *
                            </label>
                            <select
                              required
                              value={bulkInvForm.academicYearId}
                              onChange={(e) => setBulkInvForm({ ...bulkInvForm, academicYearId: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Year --</option>
                              {academicYears.map((y) => (
                                <option key={y.id} value={y.id}>
                                  {y.year} {y.status === 'ACTIVE' || y.status === 'Active' ? '(Active)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Term *
                            </label>
                            <select
                              required
                              value={bulkInvForm.term}
                              onChange={(e) => setBulkInvForm({ ...bulkInvForm, term: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                            </select>
                          </div>
                        </div>

                        {/* Fee Category Package */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Billing Category Package
                            </label>
                            <select
                              value={bulkInvForm.category}
                              onChange={(e) => {
                                const selectedCatName = e.target.value;
                                const matchedCat = billingCategories.find((bc) => bc.name === selectedCatName);
                                setBulkInvForm((prev) => ({
                                  ...prev,
                                  category: selectedCatName,
                                  totalAmount: matchedCat ? String(matchedCat.totalAmount) : prev.totalAmount,
                                  items: matchedCat?.items || prev.items,
                                }));
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="Tuition">Tuition</option>
                              <option value="Lab Fee">Lab Fee</option>
                              <option value="Sports">Sports</option>
                              <option value="Transportation">Transportation</option>
                              <option value="Books">Books</option>
                              <option value="Uniform">Uniform</option>
                              {billingCategories
                                .filter((bc) => !['Tuition', 'Lab Fee', 'Sports', 'Transportation', 'Books', 'Uniform'].includes(bc.name))
                                .map((bc) => (
                                  <option key={bc.id} value={bc.name}>
                                    {bc.name} (GHS {Number(bc.totalAmount).toFixed(2)})
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Payment Due Date
                            </label>
                            <input
                              type="date"
                              value={bulkInvForm.dueDate}
                              onChange={(e) => setBulkInvForm({ ...bulkInvForm, dueDate: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                            Fee Items Description
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Terminal Tuition, PTA Dues, Computer Lab Fee"
                            value={bulkInvForm.items}
                            onChange={(e) => setBulkInvForm({ ...bulkInvForm, items: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                            Amount Per Student (GHS) *
                          </label>
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={bulkInvForm.totalAmount}
                            onChange={(e) => setBulkInvForm({ ...bulkInvForm, totalAmount: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowBulkInvoiceModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={bulkInvLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {bulkInvLoading ? 'Generating Invoices...' : '⚡ Generate Class Invoices'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* EDIT INVOICE MODAL */}
              {showEditInvoiceModal && editingInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Edit Invoice</h3>
                        <p className="text-xs text-slate-500">
                          {editingInvoice.invoiceNumber} · {editingInvoice.student ? `${editingInvoice.student.firstName} ${editingInvoice.student.lastName}` : 'Student'}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowEditInvoiceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleEditInvoiceSubmit} className="flex flex-col flex-1 overflow-hidden">
                      <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {editInvoiceError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                            {editInvoiceError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Student (Read Only)
                            </label>
                            <input
                              type="text"
                              disabled
                              value={
                                editingInvoice.student
                                  ? `${editingInvoice.student.firstName} ${editingInvoice.student.lastName} (${editingInvoice.student.studentId})`
                                  : 'Student'
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-100 text-slate-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Fee Category *
                            </label>
                            <select
                              required
                              value={editInvoiceForm.category}
                              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, category: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="Tuition">Tuition</option>
                              <option value="Lab Fee">Lab Fee</option>
                              <option value="Sports">Sports</option>
                              <option value="Transportation">Transportation</option>
                              <option value="Books">Books</option>
                              <option value="Uniform">Uniform</option>
                              <option value="Examination">Examination</option>
                              <option value="PTA Levy">PTA Levy</option>
                              <option value="Boarding">Boarding</option>
                              <option value="Other">Other</option>
                              {billingCategories
                                .filter((bc) => !['Tuition', 'Lab Fee', 'Sports', 'Transportation', 'Books', 'Uniform', 'Examination', 'PTA Levy', 'Boarding', 'Other'].includes(bc.name))
                                .map((bc) => (
                                  <option key={bc.id} value={bc.name}>
                                    {bc.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                            Fee Items / Description
                          </label>
                          <input
                            type="text"
                            value={editInvoiceForm.items}
                            onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, items: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Academic Year *
                            </label>
                            <select
                              required
                              value={editInvoiceForm.academicYearId}
                              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, academicYearId: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">-- Choose Year --</option>
                              {academicYears.map((y) => (
                                <option key={y.id} value={y.id}>
                                  {y.year} {y.status === 'ACTIVE' || y.status === 'Active' ? '(Active)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Term *
                            </label>
                            <select
                              required
                              value={editInvoiceForm.term}
                              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, term: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                              Status
                            </label>
                            <select
                              value={editInvoiceForm.status}
                              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, status: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="UNPAID">Unpaid</option>
                              <option value="PARTIAL">Partial</option>
                              <option value="PAID">Paid</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </div>
                        </div>

                        {/* Amounts & Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Total Amount Due (GHS) *
                            </label>
                            <input
                              type="number"
                              required
                              min="0.01"
                              step="0.01"
                              value={editInvoiceForm.totalAmount}
                              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, totalAmount: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Paid Amount (GHS)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editInvoiceForm.paidAmount}
                              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, paidAmount: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Issue Date
                            </label>
                            <input
                              type="date"
                              value={editInvoiceForm.issueDate}
                              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, issueDate: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                              Due Date
                            </label>
                            <input
                              type="date"
                              value={editInvoiceForm.dueDate}
                              onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, dueDate: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>

                        {/* Live Balance Preview */}
                        {(() => {
                          const tot = parseFloat(editInvoiceForm.totalAmount) || 0;
                          const paid = parseFloat(editInvoiceForm.paidAmount) || 0;
                          const bal = Math.max(0, tot - paid);

                          return (
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center gap-4 text-xs font-mono">
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Total</span>
                                  <span className="font-bold text-slate-800">GHS {tot.toFixed(2)}</span>
                                </div>
                                <span className="text-slate-300 font-sans">-</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Paid</span>
                                  <span className="font-bold text-emerald-600">GHS {paid.toFixed(2)}</span>
                                </div>
                                <span className="text-slate-300 font-sans">=</span>
                                <div>
                                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Balance</span>
                                  <span className="font-extrabold text-blue-700 text-sm">GHS {bal.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowEditInvoiceModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editInvoiceLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {editInvoiceLoading ? 'Updating...' : 'Update Invoice'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE INVOICE MODAL */}
              {showDeleteInvoiceModal && deletingInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>⚠️</span> Delete Invoice
                      </h3>
                      <button
                        onClick={() => setShowDeleteInvoiceModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="px-6 py-5 space-y-2">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete invoice <strong className="text-slate-900">{deletingInvoice.invoiceNumber}</strong> issued to{' '}
                        <strong className="text-slate-900">
                          {deletingInvoice.student
                            ? `${deletingInvoice.student.firstName} ${deletingInvoice.student.lastName}`
                            : 'Student'}
                        </strong>{' '}
                        for <strong className="text-slate-900">GHS {Number(deletingInvoice.totalAmount).toFixed(2)}</strong>?
                      </p>
                      <p className="text-xs text-red-500">
                        This action cannot be undone and will permanently remove this invoice record.
                      </p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeleteInvoiceModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteInvoice}
                        disabled={deleteInvoiceLoading}
                        className="px-5 py-2 rounded-xl bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {deleteInvoiceLoading ? 'Deleting...' : 'Delete Invoice'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <span>💰</span> Fee Collections & Payments
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {payments.length} Records
                    </span>
                  </h1>
                  <p className="text-sm text-slate-500">
                    Record student fee payments, track class balances, and issue perforated dual-copy A4 official receipts.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const printSec = document.getElementById('classBreakdownSection');
                      if (printSec) printSec.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition shadow-sm flex items-center gap-1.5"
                  >
                    <span>📊</span> Class Breakdown
                  </button>
                  {can('payments', 'create') && (
                      <button
                      onClick={() => {
                        setPaymentForm({
                          studentId: '',
                          invoiceId: '',
                          academicYearId: academicYears.find((y) => y.status === 'Active')?.id || (academicYears[0]?.id || ''),
                          term: 'Term 1',
                          paymentDate: new Date().toISOString().split('T')[0],
                          amountPaid: '',
                          paymentMethod: 'Cash',
                          referenceNo: '',
                          notes: '',
                        });
                        setPaySelectedClassId('');
                        setPayClassStudents([]);
                        setPayStudentInvoices([]);
                        setPaymentFormError('');
                        setShowAddPaymentModal(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition shadow-sm flex items-center gap-1.5"
                    >
                      <span>+</span> Record Payment
                    </button>
                  )}
                </div>
              </div>

              {/* NOTICE BANNER */}
              {paymentsNotice && (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
                    paymentsNotice.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{paymentsNotice.type === 'success' ? '✅' : '⚠️'}</span>
                    <span>{paymentsNotice.message}</span>
                  </div>
                  <button
                    onClick={() => setPaymentsNotice(null)}
                    className="text-xs font-bold hover:underline ml-4"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* 4 SUMMARY METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Total Collected</span>
                    <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm">💳</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    GHS {totalPaymentsCollected.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Cumulative payments recorded across all terms
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Total Receipts</span>
                    <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm">📋</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {totalPaymentsCount}
                  </div>
                  <div className="text-xs text-slate-500">
                    Completed payment transactions
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Average Payment</span>
                    <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm">⏳</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    GHS {avgPaymentAmount.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Mean amount collected per receipt
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Outstanding Invoices</span>
                    <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg text-sm">⚠️</span>
                  </div>
                  <div className="text-2xl font-black text-amber-600">
                    GHS {totalOutstandingBalance.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Total unpaid balance across student bills
                  </div>
                </div>
              </div>

              {/* CLASS PAYMENT PROGRESS BREAKDOWN */}
              <div id="classBreakdownSection" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>📊</span> Class Payment Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">
                      Real-time fee collection progress and unpaid balances by classroom.
                    </p>
                  </div>
                  <div className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600">
                    {paymentsYearFilter ? `Year: ${academicYears.find(y => y.id === paymentsYearFilter)?.year || paymentsYearFilter}` : 'All Academic Years'} • {paymentsTermFilter || 'All Terms'}
                  </div>
                </div>

                {/* Progress bars list */}
                <div className="space-y-3 pt-1">
                  {classPaymentMetrics.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      No classes found. Add classes to view payment breakdown.
                    </div>
                  ) : (
                    classPaymentMetrics.map((c: any) => (
                      <div key={c.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>🏫</span> {c.name}
                            <span className="text-[10px] font-normal text-slate-400">({c.studentCount} pupils)</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-700 font-bold">Paid: GHS {c.collected.toFixed(2)}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-amber-700 font-semibold">Bal: GHS {c.balance.toFixed(2)}</span>
                            <span className="font-mono text-xs font-extrabold text-slate-900 w-12 text-right">{c.progressPercent}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${c.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* FILTER TOOLBAR */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search box */}
                  <div className="relative flex-1 min-w-[240px]">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={paymentsSearch}
                      onChange={(e) => setPaymentsSearch(e.target.value)}
                      placeholder="Search Receipt #, Student, Reference, Method..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* Academic Year filter */}
                  <select
                    value={paymentsYearFilter}
                    onChange={(e) => setPaymentsYearFilter(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">All Academic Years</option>
                    {academicYears.map((yr) => (
                      <option key={yr.id} value={yr.id}>
                        {yr.year} {yr.status === 'Active' ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>

                  {/* Term filter */}
                  <select
                    value={paymentsTermFilter}
                    onChange={(e) => setPaymentsTermFilter(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">All Terms</option>
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>

                  {/* Class filter */}
                  <select
                    value={paymentsClassFilter}
                    onChange={(e) => setPaymentsClassFilter(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">All Classes</option>
                    {classesList.map((cls: ClassRecord) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>

                  {/* Payment Method filter */}
                  <select
                    value={paymentsMethodFilter}
                    onChange={(e) => setPaymentsMethodFilter(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">All Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>

                  {/* Status filter */}
                  <select
                    value={paymentsStatusFilter}
                    onChange={(e) => setPaymentsStatusFilter(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">All Balance Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Part Payment">Part Payment</option>
                    <option value="No Payment">No Payment</option>
                  </select>

                  {/* Date range filters */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="date"
                      value={paymentsDateFromFilter}
                      onChange={(e) => setPaymentsDateFromFilter(e.target.value)}
                      title="From Date"
                      className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    />
                    <span>-</span>
                    <input
                      type="date"
                      value={paymentsDateToFilter}
                      onChange={(e) => setPaymentsDateToFilter(e.target.value)}
                      title="To Date"
                      className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    />
                  </div>

                  {/* Clear button */}
                  {(paymentsSearch ||
                    paymentsYearFilter ||
                    paymentsTermFilter ||
                    paymentsClassFilter ||
                    paymentsMethodFilter ||
                    paymentsStatusFilter ||
                    paymentsDateFromFilter ||
                    paymentsDateToFilter) && (
                    <button
                      onClick={() => {
                        setPaymentsSearch('');
                        setPaymentsYearFilter('');
                        setPaymentsTermFilter('');
                        setPaymentsClassFilter('');
                        setPaymentsMethodFilter('');
                        setPaymentsStatusFilter('');
                        setPaymentsDateFromFilter('');
                        setPaymentsDateToFilter('');
                      }}
                      className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* PAYMENTS DIRECTORY TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Receipt #</th>
                        <th className="py-3 px-4">Invoice # / Item</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Amount Paid</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4">Reference No</th>
                        <th className="py-3 px-4">Term & Year</th>
                        <th className="py-3 px-4">Invoice Balance</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paymentsLoading ? (
                        <tr>
                          <td colSpan={12} className="py-8 text-center text-slate-400">
                            Loading payment records...
                          </td>
                        </tr>
                      ) : filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-8 text-center text-slate-400">
                            No payment records found. Click "+ Record Payment" to issue a receipt.
                          </td>
                        </tr>
                      ) : (
                        filteredPayments.map((pay) => (
                          <tr key={pay.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {pay.receiptNumber}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-slate-700 font-semibold">{pay.invoiceNumber}</span>
                              {pay.categoryName && (
                                <span className="block text-[11px] text-slate-400 font-normal">
                                  {pay.categoryName}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 block">{pay.studentName}</span>
                              <span className="text-[11px] font-mono text-slate-400">{pay.studentId}</span>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600">
                              {pay.studentClass || '—'}
                            </td>
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                              {pay.paymentDate}
                            </td>
                            <td className="py-3 px-4 font-mono font-extrabold text-emerald-700 text-sm whitespace-nowrap">
                              GHS {pay.amountPaid.toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                                {pay.paymentMethod === 'Cash' && '💵 Cash'}
                                {pay.paymentMethod === 'Mobile Money' && '📱 MoMo'}
                                {pay.paymentMethod === 'Bank Transfer' && '🏦 Bank'}
                                {pay.paymentMethod === 'Cheque' && '📝 Cheque'}
                                {!['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque'].includes(pay.paymentMethod) && pay.paymentMethod}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {pay.referenceNo || '—'}
                            </td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              <span className="block font-medium text-slate-700">{pay.term}</span>
                              <span className="text-[11px]">{pay.academicYear}</span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              GHS {pay.balance.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wide uppercase ${
                                  pay.balanceStatus === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : pay.balanceStatus === 'Part Payment'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                              >
                                {pay.balanceStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openReceiptPreview(pay)}
                                  title="Print Official A4 Perforated Receipt"
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
                                >
                                  🧾
                                </button>
                                {can('payments', 'edit') && (
                                    <button
                                    onClick={() => openEditPaymentModal(pay)}
                                    title="Edit Payment"
                                    className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
                                  >
                                    ✏️
                                  </button>
                                )}
                                {can('payments', 'delete') && (
                                    <button
                                    onClick={() => openDeletePaymentModal(pay)}
                                    title="Delete Payment"
                                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 transition"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RECORD NEW PAYMENT MODAL */}
              {showAddPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden my-8">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>💰</span> Record New Payment
                        </h3>
                        <p className="text-xs text-slate-500">Collect pupil fee and auto-recalculate invoice balance.</p>
                      </div>
                      <button
                        onClick={() => setShowAddPaymentModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleCreatePayment}>
                      <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                        {paymentFormError && (
                          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                            <span>⚠️</span> {paymentFormError}
                          </div>
                        )}

                        {/* Class Filter to populate students */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 block">
                            1. Select Class
                          </label>
                          <select
                            value={paySelectedClassId}
                            onChange={(e) => handleClassSelectForPayment(e.target.value)}
                            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                          >
                            <option value="">Select Class to Filter Students</option>
                            {classesList.map((cls: ClassRecord) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Student Dropdown */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 block">
                            2. Select Student <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={paymentForm.studentId}
                            onChange={(e) => handleStudentSelectForPayment(e.target.value)}
                            required
                            disabled={payClassStudentsLoading}
                            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white disabled:bg-slate-50"
                          >
                            <option value="">
                              {payClassStudentsLoading ? 'Loading students...' : 'Choose Student...'}
                            </option>
                            {payClassStudents.map((stu) => (
                              <option key={stu.id} value={stu.id}>
                                {stu.studentId} — {stu.firstName} {stu.lastName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Invoice Selection */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 block flex items-center justify-between">
                            <span>3. Link to Invoice</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              {payStudentInvoicesLoading ? 'Loading invoices...' : `${payStudentInvoices.length} invoices found`}
                            </span>
                          </label>
                          <select
                            value={paymentForm.invoiceId}
                            onChange={(e) => handleInvoiceSelectForPayment(e.target.value)}
                            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                          >
                            <option value="">Auto-create or link to open fee balance</option>
                            {payStudentInvoices.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.invoiceNumber} — {inv.category || 'Tuition'} (Bal: GHS {Number(inv.balance).toFixed(2)} of GHS {Number(inv.totalAmount).toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Academic Year and Term */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">Academic Year</label>
                            <select
                              value={paymentForm.academicYearId}
                              onChange={(e) => setPaymentForm({ ...paymentForm, academicYearId: e.target.value })}
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                            >
                              {academicYears.map((yr) => (
                                <option key={yr.id} value={yr.id}>
                                  {yr.year}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">Term</label>
                            <select
                              value={paymentForm.term}
                              onChange={(e) => setPaymentForm({ ...paymentForm, term: e.target.value })}
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                            >
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                            </select>
                          </div>
                        </div>

                        {/* Amount Paid & Payment Date */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Amount Paid (GHS) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={paymentForm.amountPaid}
                              onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
                              placeholder="0.00"
                              required
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Payment Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={paymentForm.paymentDate}
                              onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                              required
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Payment Method & Reference No */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Payment Method <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={paymentForm.paymentMethod}
                              onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                            >
                              <option value="Cash">Cash</option>
                              <option value="Mobile Money">Mobile Money</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Cheque">Cheque</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Reference No (e.g. MOMO ID)
                            </label>
                            <input
                              type="text"
                              value={paymentForm.referenceNo}
                              onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                              placeholder="e.g. MOMO-982138"
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                            />
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 block">
                            Notes / Remarks
                          </label>
                          <textarea
                            value={paymentForm.notes}
                            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                            placeholder="Optional notes, payer name, bank branch, etc."
                            rows={2}
                            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                        </div>

                        {/* Live Balance Preview */}
                        {(() => {
                          const paying = parseFloat(paymentForm.amountPaid) || 0;
                          const selectedInv = payStudentInvoices.find((i) => i.id === paymentForm.invoiceId);
                          const curBal = selectedInv ? Number(selectedInv.balance) : paying;
                          const projBal = Math.max(0, curBal - paying);

                          return (
                            <div className="bg-gradient-to-br from-emerald-50/50 to-slate-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between text-xs font-mono">
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-sans">Current Balance</span>
                                <span className="font-bold text-slate-800">GHS {curBal.toFixed(2)}</span>
                              </div>
                              <span className="text-slate-300 font-sans">-</span>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-sans">Paying</span>
                                <span className="font-bold text-emerald-600">GHS {paying.toFixed(2)}</span>
                              </div>
                              <span className="text-slate-300 font-sans">=</span>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-sans">Remaining Balance</span>
                                <span className="font-extrabold text-slate-900 text-sm">GHS {projBal.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowAddPaymentModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={paymentFormLoading}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          {paymentFormLoading ? 'Recording...' : 'Save & Issue Receipt'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* EDIT PAYMENT MODAL */}
              {showEditPaymentModal && editingPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
                  <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden my-8">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>✏️</span> Edit Payment {editingPayment.receiptNumber}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {editingPayment.studentName} ({editingPayment.studentId})
                        </p>
                      </div>
                      <button
                        onClick={() => setShowEditPaymentModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleUpdatePayment}>
                      <div className="p-6 space-y-4">
                        {editPaymentError && (
                          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                            <span>⚠️</span> {editPaymentError}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Amount Paid (GHS) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={editPaymentForm.amountPaid}
                              onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amountPaid: e.target.value })}
                              required
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Payment Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={editPaymentForm.paymentDate}
                              onChange={(e) => setEditPaymentForm({ ...editPaymentForm, paymentDate: e.target.value })}
                              required
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Payment Method
                            </label>
                            <select
                              value={editPaymentForm.paymentMethod}
                              onChange={(e) => setEditPaymentForm({ ...editPaymentForm, paymentMethod: e.target.value })}
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            >
                              <option value="Cash">Cash</option>
                              <option value="Mobile Money">Mobile Money</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Cheque">Cheque</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 block">
                              Reference No
                            </label>
                            <input
                              type="text"
                              value={editPaymentForm.referenceNo}
                              onChange={(e) => setEditPaymentForm({ ...editPaymentForm, referenceNo: e.target.value })}
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 block">
                            Notes / Remarks
                          </label>
                          <textarea
                            value={editPaymentForm.notes}
                            onChange={(e) => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })}
                            rows={2}
                            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowEditPaymentModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editPaymentLoading}
                          className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {editPaymentLoading ? 'Saving...' : 'Update Payment'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DELETE PAYMENT MODAL */}
              {showDeletePaymentModal && deletingPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>⚠️</span> Delete Payment
                      </h3>
                      <button
                        onClick={() => setShowDeletePaymentModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="p-6 space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Are you sure you want to delete payment receipt{' '}
                        <strong className="text-slate-900 font-mono">{deletingPayment.receiptNumber}</strong> of{' '}
                        <strong className="text-emerald-700">GHS {deletingPayment.amountPaid.toFixed(2)}</strong> for{' '}
                        <strong>{deletingPayment.studentName}</strong>?
                      </p>
                      <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        ⚠️ Deleting this payment will restore the outstanding balance of GHS {deletingPayment.amountPaid.toFixed(2)} back onto invoice {deletingPayment.invoiceNumber}.
                      </p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeletePaymentModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeletePayment}
                        disabled={deletePaymentLoading}
                        className="px-5 py-2 rounded-xl bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {deletePaymentLoading ? 'Deleting...' : 'Delete & Restore Balance'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* DUAL-COPY PERFORATED OFFICIAL PRINTABLE RECEIPT MODAL */}
              {showReceiptPreviewModal && selectedPaymentForReceipt && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/80 backdrop-blur-sm overflow-hidden">
                  {/* Toolbar */}
                  <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧾</span>
                      <h4 className="font-bold text-sm text-slate-100">
                        Official Payment Receipt — {selectedPaymentForReceipt.receiptNumber}
                      </h4>
                      <span className="text-xs text-slate-400 ml-2">
                        Dual-Copy Perforated Format (Student + School Copy)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowReceiptPreviewModal(false)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition"
                      >
                        ✕ Close
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5"
                      >
                        <span>🖨️</span> Print Receipt
                      </button>
                    </div>
                  </div>

                  {/* Scrollable A4 Container */}
                  <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex justify-center bg-slate-800/40">
                    <div
                      id="printableReceiptArea"
                      className="bg-white text-black w-full max-w-[210mm] min-h-[297mm] p-[10mm] shadow-2xl flex flex-col justify-between font-sans print:p-0 print:m-0 print:shadow-none print:w-full"
                    >
                      {/* HELPER FUNCTION FOR COPY */}
                      {[
                        { badge: 'STUDENT COPY', title: 'Payment Receipt' },
                        { badge: 'SCHOOL COPY', title: 'Payment Receipt' },
                      ].map((copy, index) => {
                        const pay = selectedPaymentForReceipt;
                        const prevPaid = Math.max(0, pay.invoicePaid - pay.amountPaid);
                        const cumulativePaid = pay.invoicePaid;

                        return (
                          <div key={copy.badge} className="flex-1 flex flex-col justify-between py-2">
                            {/* Copy Header */}
                            <div>
                              <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl">
                                    🏫
                                  </div>
                                  <div>
                                    <h2 className="text-base font-black tracking-tight uppercase leading-none">
                                      {tenant?.name || 'School Name'}
                                    </h2>
                                    <p className="text-[10px] text-slate-600 mt-1">
                                      Official Fee Billing & Collection Ledger
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right text-[10px] font-mono leading-tight">
                                  <div className="font-extrabold text-xs text-black">{pay.receiptNumber}</div>
                                  <div className="text-slate-500">Date: {pay.paymentDate}</div>
                                  <div className="font-semibold px-2 py-0.5 mt-1 border border-black rounded text-[9px] uppercase tracking-wider inline-block">
                                    {copy.badge}
                                  </div>
                                </div>
                              </div>

                              {/* Student & Payment Details Grid */}
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] mb-3">
                                <div className="flex justify-between border-b border-slate-200 py-0.5">
                                  <span className="font-bold text-slate-700">Student Name:</span>
                                  <span className="font-semibold text-black">{pay.studentName}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 py-0.5">
                                  <span className="font-bold text-slate-700">Student ID:</span>
                                  <span className="font-mono text-black">{pay.studentId}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 py-0.5">
                                  <span className="font-bold text-slate-700">Class:</span>
                                  <span className="font-semibold text-black">{pay.studentClass || '—'}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 py-0.5">
                                  <span className="font-bold text-slate-700">Academic Year & Term:</span>
                                  <span className="font-semibold text-black">{pay.academicYear} • {pay.term}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 py-0.5">
                                  <span className="font-bold text-slate-700">Invoice Ref:</span>
                                  <span className="font-mono text-black">{pay.invoiceNumber}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 py-0.5">
                                  <span className="font-bold text-slate-700">Billing Category:</span>
                                  <span className="text-black">{pay.categoryName || 'School Fees'}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 py-0.5">
                                  <span className="font-bold text-slate-700">Payment Method:</span>
                                  <span className="font-semibold text-black">{pay.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 py-0.5">
                                  <span className="font-bold text-slate-700">Reference / Slip #:</span>
                                  <span className="font-mono text-black">{pay.referenceNo || '—'}</span>
                                </div>
                              </div>

                              {/* Financial Summary Boxes */}
                              <div className="grid grid-cols-4 gap-2 my-2">
                                <div className="border border-black rounded p-2 text-center">
                                  <div className="text-[9px] uppercase font-bold text-slate-600">Total Billed</div>
                                  <div className="text-xs font-black font-mono">GHS {pay.invoiceTotal.toFixed(2)}</div>
                                </div>
                                <div className="border border-black rounded p-2 text-center">
                                  <div className="text-[9px] uppercase font-bold text-slate-600">Prev. Paid</div>
                                  <div className="text-xs font-mono font-semibold">GHS {prevPaid.toFixed(2)}</div>
                                </div>
                                <div className="border-2 border-black rounded p-2 text-center bg-slate-50">
                                  <div className="text-[9px] uppercase font-extrabold text-black">This Payment</div>
                                  <div className="text-sm font-black font-mono text-emerald-800">GHS {pay.amountPaid.toFixed(2)}</div>
                                </div>
                                <div className="border border-black rounded p-2 text-center">
                                  <div className="text-[9px] uppercase font-bold text-slate-600">Balance Due</div>
                                  <div className="text-xs font-black font-mono text-amber-800">GHS {pay.balance.toFixed(2)}</div>
                                </div>
                              </div>
                            </div>

                            {/* Signatures & Perforation line */}
                            <div className="mt-2">
                              <div className="flex justify-between text-[10px] text-slate-600 pt-2 border-t border-slate-300">
                                <div>Received By: <span className="font-semibold text-black">{pay.recordedBy || 'Accounts Office'}</span></div>
                                <div>Signature / Stamp: ______________________</div>
                              </div>

                              {/* Perforated Cut line only between copies */}
                              {index === 0 && (
                                <div className="my-4 flex items-center gap-3 text-slate-400 text-[10px] font-mono">
                                  <div className="flex-1 border-t-2 border-dashed border-slate-400"></div>
                                  <span className="flex items-center gap-1 font-sans text-slate-500">
                                    ✂ Cut along dotted line
                                  </span>
                                  <div className="flex-1 border-t-2 border-dashed border-slate-400"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">📊 School Analytics & Reports</h1>
                  <p className="text-sm text-slate-500">
                    {reportsData?.filters?.activeYear && (
                      <span>Academic Year: <strong>{reportsData.filters.activeYear}</strong> · Term: <strong>{reportsData.filters.activeTerm || 'All Terms'}</strong></span>
                    )}
                    {!reportsData && !reportsLoading && ' Generate enrollment, academic, financial & attendance reports.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setReportsFetched(false);
                    fetchReports(reportFilterYear, reportFilterTerm, reportFilterClass);
                  }}
                  disabled={reportsLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {reportsLoading ? '⏳ Loading…' : '🔄 Refresh Reports'}
                </button>
              </div>

              {/* Filter bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Filter:</span>
                <select
                  value={reportFilterYear}
                  onChange={(e) => { setReportFilterYear(e.target.value); setReportsFetched(false); }}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Academic Years</option>
                  {(reportsData?.filters?.availableYears ?? []).map((y) => (
                    <option key={y.id} value={y.year}>{y.year}{y.status === 'Active' ? ' ✓' : ''}</option>
                  ))}
                </select>
                <select
                  value={reportFilterTerm}
                  onChange={(e) => { setReportFilterTerm(e.target.value); setReportsFetched(false); }}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Terms</option>
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
                <select
                  value={reportFilterClass}
                  onChange={(e) => { setReportFilterClass(e.target.value); setReportsFetched(false); }}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Classes</option>
                  {(reportsData?.filters?.availableClasses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchReports(reportFilterYear, reportFilterTerm, reportFilterClass)}
                  disabled={reportsLoading}
                  className="ml-auto px-4 py-1.5 text-sm font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition disabled:opacity-60"
                >
                  Apply Filters
                </button>
              </div>

              {/* Loading shimmer */}
              {reportsLoading && (
                <div className="space-y-3 animate-pulse">
                  {[1,2,3].map((i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
                  ))}
                </div>
              )}

              {!reportsLoading && reportsData && (
                <>
                  {/* KPI cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      { label: 'Total Students', value: reportsData.kpis.totalStudents, icon: '🎓', color: 'blue' },
                      { label: 'Teachers', value: reportsData.kpis.teacherCount, icon: '👩‍🏫', color: 'violet' },
                      { label: 'Revenue', value: `${tenant?.currency ?? 'GHS'} ${reportsData.kpis.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: '💰', color: 'emerald' },
                      { label: 'Outstanding', value: `${tenant?.currency ?? 'GHS'} ${reportsData.kpis.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: '📋', color: 'amber' },
                      { label: 'Avg Performance', value: `${reportsData.kpis.avgPerformance}%`, icon: '📈', color: 'purple' },
                      { label: 'Attendance Rate', value: `${reportsData.kpis.attendanceRate}%`, icon: '📅', color: 'teal' },
                    ].map((kpi) => (
                      <div key={kpi.label} className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm`}>
                        <div className="text-xl mb-1">{kpi.icon}</div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{kpi.label}</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5 truncate">{kpi.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Sub-tab nav */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    {([
                      { id: 'overview', label: '🏠 Overview' },
                      { id: 'academic', label: '📚 Academic' },
                      { id: 'financial', label: '💰 Financial' },
                      { id: 'attendance', label: '📅 Attendance' },
                    ] as { id: 'overview'|'academic'|'financial'|'attendance'; label: string }[]).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setReportsActiveSubTab(tab.id)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${reportsActiveSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ─── Overview sub-tab ─── */}
                  {reportsActiveSubTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                      {/* Enrollment by class */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">🏫 Enrollment by Class</span>
                        </div>
                        <div className="p-5 space-y-3">
                          {reportsData.enrollmentByClass.length === 0 && (
                            <p className="text-slate-400 text-sm text-center py-6">No class data available</p>
                          )}
                          {reportsData.enrollmentByClass.map((item) => {
                            const maxCount = Math.max(...reportsData.enrollmentByClass.map((c) => c.studentCount), 1);
                            const pct = Math.round((item.studentCount / maxCount) * 100);
                            return (
                              <div key={item.classId}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium text-slate-700">{item.className}</span>
                                  <span className="font-bold text-slate-900">{item.studentCount} students</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Billing status donut-style */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-sm">💳 Billing Status Overview</span>
                        </div>
                        <div className="p-5">
                          {reportsData.billingStatus.total === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-6">No invoices for this period</p>
                          ) : (
                            <div className="space-y-3">
                              {[
                                { label: 'Paid', count: reportsData.billingStatus.paid, color: 'bg-emerald-500' },
                                { label: 'Partial', count: reportsData.billingStatus.partial, color: 'bg-amber-400' },
                                { label: 'Unpaid', count: reportsData.billingStatus.unpaid, color: 'bg-red-500' },
                                { label: 'Cancelled', count: reportsData.billingStatus.cancelled, color: 'bg-slate-400' },
                              ].map((row) => {
                                const pct = reportsData.billingStatus.total > 0 ? Math.round((row.count / reportsData.billingStatus.total) * 100) : 0;
                                return (
                                  <div key={row.label}>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="font-medium text-slate-700">{row.label}</span>
                                      <span className="font-bold text-slate-900">{row.count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-700 ${row.color}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                              <p className="text-xs text-slate-400 pt-1">Total invoices: {reportsData.billingStatus.total}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gender breakdown */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-sm">👥 Gender Breakdown</span>
                        </div>
                        <div className="p-5 flex flex-wrap gap-4">
                          {Object.entries(reportsData.genderBreakdown).length === 0 ? (
                            <p className="text-slate-400 text-sm">No data</p>
                          ) : Object.entries(reportsData.genderBreakdown).map(([gender, count]) => (
                            <div key={gender} className="text-center min-w-[80px]">
                              <div className="text-3xl font-bold text-slate-900">{count}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{gender}</div>
                              <div className="text-xs text-slate-400">{reportsData.kpis.totalStudents > 0 ? Math.round((count / reportsData.kpis.totalStudents) * 100) : 0}%</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Attendance snapshot */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-sm">📅 Attendance Snapshot</span>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Present', val: reportsData.attendance.present, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: 'Absent', val: reportsData.attendance.absent, color: 'text-red-600', bg: 'bg-red-50' },
                            { label: 'Late', val: reportsData.attendance.late, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Excused', val: reportsData.attendance.excused, color: 'text-blue-600', bg: 'bg-blue-50' },
                          ].map((a) => (
                            <div key={a.label} className={`${a.bg} rounded-xl p-3 text-center`}>
                              <div className={`text-2xl font-bold ${a.color}`}>{a.val}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{a.label}</div>
                            </div>
                          ))}
                          {reportsData.attendance.total > 0 && (
                            <div className="col-span-2 sm:col-span-4 text-xs text-slate-400 mt-1">
                              Overall rate: <strong className="text-emerald-600">{reportsData.attendance.rate}%</strong> based on {reportsData.attendance.total.toLocaleString()} records
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Academic sub-tab ─── */}
                  {reportsActiveSubTab === 'academic' && (
                    <div className="space-y-5">
                      {/* Top performers table */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">🏆 Top 10 Performing Students</span>
                          <span className="text-xs text-slate-400">{reportsData.filters.activeYear} · {reportsData.filters.activeTerm || 'All Terms'}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">#</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Student</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Class</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Avg Score</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Grade</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {reportsData.topPerformers.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No performance data for this period</td></tr>
                              ) : reportsData.topPerformers.map((p, idx) => (
                                <tr key={p.studentId} className="hover:bg-slate-50 transition">
                                  <td className="px-4 py-3 font-bold text-slate-400 text-xs">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</td>
                                  <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                                  <td className="px-4 py-3 text-slate-600 text-xs">{p.className}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400" style={{ width: `${p.avgScore}%` }} />
                                      </div>
                                      <span className="font-bold text-slate-900 text-xs">{p.avgScore}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${p.grade === 'A' ? 'bg-emerald-100 text-emerald-700' : p.grade === 'B' ? 'bg-blue-100 text-blue-700' : p.grade === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                      {p.grade}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Subject averages */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-sm">📚 Average Score by Subject / Course</span>
                        </div>
                        <div className="p-5 space-y-3">
                          {reportsData.subjectAverages.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-6">No subject performance data</p>
                          ) : reportsData.subjectAverages.map((s) => (
                            <div key={s.course}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-slate-700">{s.course}</span>
                                <span className="text-slate-400">{s.count} records · <strong className="text-slate-900">{s.avgScore}%</strong></span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${s.avgScore >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : s.avgScore >= 60 ? 'bg-gradient-to-r from-blue-500 to-blue-400' : s.avgScore >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                                  style={{ width: `${s.avgScore}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Financial sub-tab ─── */}
                  {reportsActiveSubTab === 'financial' && (
                    <div className="space-y-5">
                      {/* Revenue summary cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { label: 'Total Billed', value: reportsData.kpis.totalRevenue + reportsData.kpis.outstanding, icon: '🧾', color: 'bg-blue-50 text-blue-700' },
                          { label: 'Collected', value: reportsData.kpis.totalRevenue, icon: '✅', color: 'bg-emerald-50 text-emerald-700' },
                          { label: 'Outstanding', value: reportsData.kpis.outstanding, icon: '⚠️', color: 'bg-amber-50 text-amber-700' },
                        ].map((card) => (
                          <div key={card.label} className={`${card.color} rounded-2xl p-5 border border-slate-200`}>
                            <div className="text-2xl mb-1">{card.icon}</div>
                            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</div>
                            <div className="text-xl font-bold mt-1">
                              {tenant?.currency ?? 'GHS'} {card.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Fee debtors table */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">🚨 Fee Debtors Ledger</span>
                          <span className="text-xs text-slate-400">{reportsData.debtors.length} outstanding invoices</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Student</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Class</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Paid</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Balance</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {reportsData.debtors.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">🎉 No outstanding invoices for this period</td></tr>
                              ) : reportsData.debtors.map((d, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition">
                                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.invoiceNumber}</td>
                                  <td className="px-4 py-3 font-semibold text-slate-900">{d.studentName}</td>
                                  <td className="px-4 py-3 text-slate-500 text-xs">{d.studentClass}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{(d.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3 text-right text-emerald-700">{(d.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3 text-right font-bold text-red-600">{(d.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${d.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                      {d.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Recent invoices */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-sm">📄 Recent Invoices (latest 20)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Invoice #</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Student</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Class</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Paid</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Balance</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {reportsData.recentInvoices.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No invoices for this period</td></tr>
                              ) : reportsData.recentInvoices.map((inv, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition">
                                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{inv.invoiceNumber}</td>
                                  <td className="px-4 py-3 font-semibold text-slate-900">{inv.studentName}</td>
                                  <td className="px-4 py-3 text-slate-500 text-xs">{inv.studentClass}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3 text-right text-emerald-700">{(inv.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-900">{(inv.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : inv.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-700'}`}>
                                      {inv.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Attendance sub-tab ─── */}
                  {reportsActiveSubTab === 'attendance' && (
                    <div className="space-y-5">
                      {/* Summary card */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                        <h3 className="font-bold text-slate-900 text-sm mb-4">📅 Attendance Summary</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                          {[
                            { label: 'Total Records', val: reportsData.attendance.total, color: 'text-slate-900' },
                            { label: 'Present', val: reportsData.attendance.present, color: 'text-emerald-600' },
                            { label: 'Absent', val: reportsData.attendance.absent, color: 'text-red-600' },
                            { label: 'Late', val: reportsData.attendance.late, color: 'text-amber-600' },
                            { label: 'Excused', val: reportsData.attendance.excused, color: 'text-blue-600' },
                          ].map((a) => (
                            <div key={a.label} className="text-center">
                              <div className={`text-3xl font-bold ${a.color}`}>{a.val.toLocaleString()}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{a.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Stacked bar */}
                        {reportsData.attendance.total > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>Attendance breakdown</span>
                              <span>Rate: <strong className="text-emerald-600">{reportsData.attendance.rate}%</strong></span>
                            </div>
                            <div className="h-5 bg-slate-100 rounded-full overflow-hidden flex">
                              {[
                                { val: reportsData.attendance.present, color: 'bg-emerald-500' },
                                { val: reportsData.attendance.late, color: 'bg-amber-400' },
                                { val: reportsData.attendance.excused, color: 'bg-blue-400' },
                                { val: reportsData.attendance.absent, color: 'bg-red-500' },
                              ].map((seg, i) => {
                                const pct = reportsData.attendance.total > 0 ? (seg.val / reportsData.attendance.total) * 100 : 0;
                                return pct > 0 ? (
                                  <div key={i} className={`${seg.color} h-full transition-all duration-700`} style={{ width: `${pct}%` }} title={`${seg.val} (${pct.toFixed(1)}%)`} />
                                ) : null;
                              })}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-1">
                              {[
                                { label: 'Present', color: 'bg-emerald-500' },
                                { label: 'Late', color: 'bg-amber-400' },
                                { label: 'Excused', color: 'bg-blue-400' },
                                { label: 'Absent', color: 'bg-red-500' },
                              ].map((l) => (
                                <span key={l.label} className="flex items-center gap-1">
                                  <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                                  {l.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {reportsData.attendance.total === 0 && (
                          <p className="text-slate-400 text-sm text-center py-4">No attendance records match the current filter.</p>
                        )}
                      </div>

                      {/* Enrollment by class repeated here for context */}
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-sm">🏫 Student Count by Class</span>
                        </div>
                        <div className="p-5 space-y-3">
                          {reportsData.enrollmentByClass.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-6">No classes configured</p>
                          ) : reportsData.enrollmentByClass.map((item) => {
                            const maxCount = Math.max(...reportsData.enrollmentByClass.map((c) => c.studentCount), 1);
                            const pct = Math.round((item.studentCount / maxCount) * 100);
                            return (
                              <div key={item.classId}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium text-slate-700">{item.className}</span>
                                  <span className="font-bold text-slate-900">{item.studentCount}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Empty state — never fetched */}
              {!reportsLoading && !reportsData && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="text-5xl mb-4">📊</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No report data loaded yet</h3>
                  <p className="text-sm text-slate-400 mb-4">Click <strong>Refresh Reports</strong> to generate the analytics dashboard for this tenant.</p>
                  <button
                    onClick={() => fetchReports(reportFilterYear, reportFilterTerm, reportFilterClass)}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
                  >
                    📊 Generate Reports
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: SUBSCRIPTION & BILLING */}
          {activeTab === 'subscription' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* Top Title & Refresh */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-slate-900">Subscription &amp; Licensing</h1>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      Multi-Tenant SaaS
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage student enrollment capacity, license renewals, MoMo billing, and payment receipts for <strong>{tenant?.name || 'your school'}</strong>.
                  </p>
                </div>
                <button
                  onClick={fetchSubscriptionData}
                  disabled={subscriptionLoading}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <span className={subscriptionLoading ? 'animate-spin' : ''}>🔄</span>
                  <span>{subscriptionLoading ? 'Refreshing...' : 'Refresh Status'}</span>
                </button>
              </div>

              {/* Current Active Plan Status Banner */}
              <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🛡️</span>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                            {subscriptionData?.currentSubscription?.plan || tenant?.plan || 'DEMO'} TIER
                          </h2>
                          {tenant?.subscription?.status === 'active' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                              ● Active License
                            </span>
                          )}
                          {tenant?.subscription?.status === 'expiring_soon' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider animate-pulse">
                              ⏳ Due in {tenant?.subscription?.daysRemaining} Day{tenant?.subscription?.daysRemaining === 1 ? '' : 's'}
                            </span>
                          )}
                          {tenant?.subscription?.status === 'expired' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-wider">
                              ● Overdue / Locked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Tenant ID: <span className="font-mono text-blue-300">{tenant?.id}</span> • School Subdomain:{' '}
                          <span className="font-mono text-blue-300">{tenant?.subdomain}.smsapp.com</span>
                        </p>
                      </div>
                    </div>

                    {/* Student capacity usage bar */}
                    <div className="pt-2 max-w-md">
                      <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                        <span>Student Capacity</span>
                        <span className="font-bold text-white">
                          {subscriptionData?.usage?.studentCount ?? students.length} / {subscriptionData?.usage?.studentLimit ?? tenant?.studentLimit ?? 15} Students
                          ({subscriptionData?.usage?.quotaPercentage ?? (tenant?.studentLimit ? Math.round((students.length / tenant.studentLimit) * 100) : 0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (subscriptionData?.usage?.quotaPercentage ?? 0) >= 90
                              ? 'bg-rose-500'
                              : (subscriptionData?.usage?.quotaPercentage ?? 0) >= 70
                              ? 'bg-amber-400'
                              : 'bg-blue-400'
                          }`}
                          style={{
                            width: `${Math.min(subscriptionData?.usage?.quotaPercentage ?? 0, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
                        <span>Remaining slots: <strong>{subscriptionData?.usage?.remainingSlots ?? Math.max(0, (tenant?.studentLimit || 15) - students.length)}</strong></span>
                        <span>Billing cycle: <strong className="capitalize">{subscriptionData?.currentSubscription?.billingCycle || 'Monthly'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Status metrics grid */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0 bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Renewal Due</div>
                      <div className="text-sm sm:text-base font-bold text-white mt-0.5">
                        {tenant?.subscription?.currentPeriodEnd
                          ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'In 14 Days'}
                      </div>
                      <div className="text-[11px] text-blue-300">
                        {tenant?.subscription?.daysRemaining !== undefined
                          ? tenant.subscription.daysRemaining > 0
                            ? `${tenant.subscription.daysRemaining} days left`
                            : 'Expired'
                          : 'Trial Active'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Plan Rate</div>
                      <div className="text-sm sm:text-base font-bold text-white mt-0.5">
                        {tenant?.currency || 'GHS'} {subscriptionData?.currentSubscription?.amount !== undefined ? Number(subscriptionData.currentSubscription.amount).toFixed(2) : '0.00'}
                      </div>
                      <div className="text-[11px] text-slate-400 capitalize">
                        {subscriptionData?.currentSubscription?.billingCycle || 'Trial'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE SIMULATION / TESTING TOOLBAR (ADMIN TOOLS) */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-blue-50/60 p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🧪</span>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-indigo-950">
                        Interactive Subscription Status Testing (Admin Sandbox)
                      </h3>
                      <p className="text-[11px] text-indigo-700">
                        Test the real-time prompt warnings and overdue screen lock behavior instantly.
                      </p>
                    </div>
                  </div>
                  {simulationLoading && (
                    <span className="text-xs font-semibold text-indigo-600 animate-pulse flex items-center gap-1">
                      <span>⚙️ Updating state...</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => handleSimulateStatus('set_expiring')}
                    disabled={simulationLoading}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5"
                    title="Simulates 3 days remaining before expiration to trigger the due warning prompt"
                  >
                    <span>⏳ Test "Due Soon" (3 Days Left)</span>
                  </button>
                  <button
                    onClick={() => handleSimulateStatus('set_expired')}
                    disabled={simulationLoading}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5"
                    title="Simulates an expired subscription to trigger the impenetrable screen lock"
                  >
                    <span>🔒 Test "Overdue Lock" (Expired)</span>
                  </button>
                  <button
                    onClick={() => handleSimulateStatus('set_active')}
                    disabled={simulationLoading}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5"
                    title="Restores subscription to active state with 30 days remaining"
                  >
                    <span>✅ Restore "Active" (30 Days)</span>
                  </button>
                </div>
              </div>

              {/* Billing Cycle Switcher & Plan Catalog */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Available School Subscription Tiers</h2>
                    <p className="text-xs text-slate-500">
                      All tiers include full Ghanaian GES grading, marks recording, and mobile money invoicing.
                    </p>
                  </div>

                  {/* Billing Cycle Toggle */}
                  <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 self-start sm:self-auto">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                        billingCycle === 'monthly'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle('termly')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1 ${
                        billingCycle === 'termly'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Termly (4 Mo)</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 text-blue-700">
                        -10%
                      </span>
                    </button>
                    <button
                      onClick={() => setBillingCycle('annual')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1 ${
                        billingCycle === 'annual'
                          ? 'bg-white text-emerald-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Annual (12 Mo)</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-700">
                        -20%
                      </span>
                    </button>
                  </div>
                </div>

                {/* Online Payment Gateway Selector Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 rounded-2xl border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      💳
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Select Online Payment Gateway</h3>
                      <p className="text-[11px] text-slate-500">
                        Choose your preferred payment method. System automatically upgrades school quotas upon successful payment.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'paystack', name: 'Paystack', desc: 'Ghana MoMo & Cards', icon: '🟢' },
                      { id: 'flutterwave', name: 'Flutterwave', desc: 'Pan-Africa & MoMo', icon: '🟠' },
                      { id: 'stripe', name: 'Stripe', desc: 'Cards & Apple Pay', icon: '🟣' },
                      { id: 'sandbox', name: 'Instant Sandbox', desc: 'Demo Mode', icon: '⚡' },
                    ].map((gw) => {
                      const isSelected = selectedCheckoutGateway === gw.id;
                      return (
                        <button
                          key={gw.id}
                          type="button"
                          onClick={() => setSelectedCheckoutGateway(gw.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-white text-blue-700 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                              : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          <span>{gw.icon}</span>
                          <span>{gw.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                              isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {gw.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {(subscriptionData?.plans || Object.values(SUBSCRIPTION_PLANS))
                    .filter((p) => p.key !== 'DEMO')
                    .map((plan) => {
                      const isCurrent = (tenant?.plan || 'DEMO') === plan.key;
                      const price =
                        billingCycle === 'annual'
                          ? plan.priceAnnual
                          : billingCycle === 'termly'
                          ? plan.priceTermly
                          : plan.priceMonthly;

                      return (
                        <div
                          key={plan.key}
                          className={`rounded-2xl border flex flex-col justify-between p-5 transition-all ${
                            isCurrent
                              ? 'border-blue-600 bg-blue-50/30 ring-2 ring-blue-500/20 shadow-md'
                              : plan.popular
                              ? 'border-indigo-400 bg-white ring-1 ring-indigo-300 shadow-sm hover:shadow-md'
                              : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                          }`}
                        >
                          <div>
                            {plan.popular && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white uppercase tracking-wider mb-2">
                                MOST POPULAR
                              </span>
                            )}
                            {isCurrent && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white uppercase tracking-wider mb-2">
                                CURRENT PLAN
                              </span>
                            )}
                            <h3 className="font-black text-base text-slate-900">{plan.name}</h3>
                            <div className="mt-1 text-xs font-bold text-blue-600">
                              Up to {plan.studentLimit} Students
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 min-h-[32px] line-clamp-2">
                              {plan.description}
                            </p>

                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-900">
                                  {tenant?.currency || 'GHS'} {price}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                  /{billingCycle === 'annual' ? 'yr' : billingCycle === 'termly' ? 'term' : 'mo'}
                                </span>
                              </div>
                            </div>

                            {/* Features list */}
                            <ul className="mt-4 space-y-2 text-[11px] text-slate-600">
                              {plan.features.map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                                  <span>{feat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="mt-6 pt-3 border-t border-slate-100 space-y-2">
                            <button
                              onClick={() =>
                                handleInitiateCheckout(
                                  plan.key,
                                  billingCycle,
                                  selectedCheckoutGateway === 'sandbox',
                                  selectedCheckoutGateway
                                )
                              }
                              disabled={checkoutLoading}
                              className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 ${
                                isCurrent
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-slate-900 hover:bg-black text-white'
                              }`}
                            >
                              {checkoutLoading && selectedCheckoutPlan === plan.key ? (
                                <span className="animate-spin">⚙️</span>
                              ) : (
                                <span>💳</span>
                              )}
                              <span>
                                {selectedCheckoutGateway === 'sandbox'
                                  ? `Instant Sandbox: ${plan.name.replace(' Plan', '')}`
                                  : isCurrent
                                  ? `Renew via ${selectedCheckoutGateway === 'paystack' ? 'Paystack' : selectedCheckoutGateway === 'flutterwave' ? 'Flutterwave' : 'Stripe'}`
                                  : `Pay via ${selectedCheckoutGateway === 'paystack' ? 'Paystack' : selectedCheckoutGateway === 'flutterwave' ? 'Flutterwave' : 'Stripe'}`}
                              </span>
                            </button>

                            {/* Instant sandbox demo upgrade button */}
                            {selectedCheckoutGateway !== 'sandbox' && (
                              <button
                                onClick={() => handleInitiateCheckout(plan.key, billingCycle, true, 'sandbox')}
                                disabled={checkoutLoading}
                                className="w-full py-1.5 rounded-lg text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition"
                                title="Instant upgrade without live payment gateway (Sandbox mode)"
                              >
                                ⚡ Instant Sandbox Demo
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Payment & Billing History Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Payment &amp; Billing History</h3>
                    <p className="text-xs text-slate-500">
                      Download or view official payment receipts for accounting and school audit records.
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {subscriptionData?.history?.length || 0} Record(s) Found
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="px-4 py-3 text-left">Receipt / Reference</th>
                        <th className="px-4 py-3 text-left">Plan Tier</th>
                        <th className="px-4 py-3 text-left">Billing Period</th>
                        <th className="px-4 py-3 text-left">Cycle</th>
                        <th className="px-4 py-3 text-right">Amount Paid</th>
                        <th className="px-4 py-3 text-left">Gateway</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!subscriptionData?.history || subscriptionData.history.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                            No subscription payment history yet. Subscriptions activated will appear here.
                          </td>
                        </tr>
                      ) : (
                        subscriptionData.history.map((sub) => (
                          <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3 font-mono font-bold text-slate-800">
                              {sub.gatewayReference || sub.id.slice(0, 12)}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">{sub.plan}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {new Date(sub.currentPeriodStart).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}{' '}
                              -{' '}
                              {new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="px-4 py-3 capitalize text-slate-600">{sub.billingCycle}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">
                              {sub.currency} {Number(sub.amount).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 uppercase font-mono text-[10px] text-slate-500">
                              {sub.paymentGateway}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  sub.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {sub.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setReceiptModalSub(sub)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition"
                              >
                                🧾 Receipt
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Methods & Support Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">
                    📱 Supported Payment Methods (Ghana)
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span><strong>MTN Mobile Money</strong> — Instant prompt on your registered SIM (*170#)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span><strong>Telecel Cash</strong> — Automated prompt and voucher support (*110#)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span><strong>AT Money</strong> &amp; Ghanaian Bank Cards (Visa &amp; Mastercard)</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">
                    🤝 Enterprise &amp; Custom School Assistance
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Have more than 2,000 students or manage multiple campuses under one board of governors?
                    Contact our dedicated account desk for custom SLA agreements and direct bank transfer invoicing.
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs font-bold text-blue-700">
                    <span>📞 +233 (0) 50 123 4567</span>
                    <span>💬 WhatsApp Available</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OPERATIONS & MARKETING DEPARTMENT PAGES
              One generic workspace renders every department resource (assets,
              requisitions, work orders, transport, vendors, campaigns, leads,
              announcements, events, referrals). */}
          {activeDepartmentResource && (
            <DepartmentWorkspace
              key={activeDepartmentResource.key}
              resource={activeDepartmentResource}
              token={token}
              currency={tenant?.currency || 'GHS'}
              can={can}
            />
          )}

        </main>

        {/* SAAS PLATFORM FOOTER MAINTAINED */}
        <footer className="mt-auto bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 space-y-1">
          <p>© 2026 {tenant?.name || 'SMS Platform'} • Multi-Tenant School Management Platform</p>
          <p className="text-slate-400">Built for Ghanaian Basic & Senior High Schools • Supports MTN MoMo, Telecel Cash & Card Payments</p>
        </footer>
      </div>

      {/* ADD / EDIT ACADEMIC YEAR MODAL (GLOBAL) */}
      {showYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">
                {editingYear ? 'Edit Academic Year' : 'Add New Academic Year'}
              </h3>
              <button
                onClick={() => setShowYearModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleYearFormSubmit}>
              <div className="px-6 py-5 space-y-4">
                {yearFormError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                    {yearFormError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Year *</label>
                  <input
                    type="text"
                    required
                    value={yearForm.year}
                    onChange={(e) => setYearForm({ ...yearForm, year: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 2026-2027"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                    <select
                      value={yearForm.status}
                      onChange={(e) => setYearForm({ ...yearForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Current Term</label>
                    <select
                      value={yearForm.currentTerm}
                      onChange={(e) => setYearForm({ ...yearForm, currentTerm: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                  </div>
                </div>

                {yearForm.status === 'Active' && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Saving this as <strong>Active</strong> will archive the school&rsquo;s current active session.
                  </p>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowYearModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={yearFormLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {yearFormLoading ? 'Saving...' : editingYear ? 'Update Year' : 'Save Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ACADEMIC YEAR MODAL (GLOBAL) */}
      {showDeleteYearModal && deletingYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Delete Academic Year</h3>
              <button
                onClick={() => setShowDeleteYearModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to delete{' '}
                <strong className="text-slate-900">{deletingYear.year}</strong>?
              </p>
              <p className="text-xs text-red-500 mt-2">This action cannot be undone.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteYearModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteYear}
                disabled={deleteYearLoading}
                className="px-5 py-2 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition disabled:opacity-50"
              >
                {deleteYearLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENROLL STUDENT MODAL */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Enroll New Student</h3>
                <p className="text-xs text-slate-500">Quota: {stats?.studentCount || 0} / {tenant?.studentLimit || 15} students used</p>
              </div>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {enrollError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {enrollError}
              </div>
            )}

            {enrollSuccess && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                {enrollSuccess}
              </div>
            )}

            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={enrollForm.firstName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Samuel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={enrollForm.lastName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Mensah"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student ID (Optional)</label>
                  <input
                    type="text"
                    value={enrollForm.studentId}
                    onChange={(e) => setEnrollForm({ ...enrollForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={enrollForm.gender}
                    onChange={(e) => setEnrollForm({ ...enrollForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={enrollForm.dateOfBirth}
                    onChange={(e) => setEnrollForm({ ...enrollForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class</label>
                  <select
                    value={enrollForm.classId}
                    onChange={(e) => setEnrollForm({ ...enrollForm, classId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Class --</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c._count?.students || 0} students)
                      </option>
                    ))}
                  </select>
                  {classesList.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No classes available. Please create a class first.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-800 mb-2">Guardian Information</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guardian Full Name</label>
                    <input
                      type="text"
                      value={enrollForm.guardianName}
                      onChange={(e) => setEnrollForm({ ...enrollForm, guardianName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Mrs. Grace Mensah"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={enrollForm.guardianPhone}
                        onChange={(e) => setEnrollForm({ ...enrollForm, guardianPhone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="024 XXX XXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Guardian Email</label>
                      <input
                        type="email"
                        value={enrollForm.guardianEmail}
                        onChange={(e) => setEnrollForm({ ...enrollForm, guardianEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="parent@gmail.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollLoading}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {enrollLoading ? 'Enrolling...' : 'Confirm Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPGRADE SUBSCRIPTION MODAL */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Upgrade Your School Subscription</h3>
                <p className="text-xs text-slate-500">Instant unlock of student caps with Mobile Money (MTN MoMo, Telecel) or Card.</p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Gateway Selector in Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 mt-4 mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>💳</span> Gateway:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'paystack', name: 'Paystack', icon: '🟢' },
                  { id: 'flutterwave', name: 'Flutterwave', icon: '🟠' },
                  { id: 'stripe', name: 'Stripe', icon: '🟣' },
                  { id: 'sandbox', name: 'Sandbox Demo', icon: '⚡' },
                ].map((gw) => (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setSelectedCheckoutGateway(gw.id as any)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                      selectedCheckoutGateway === gw.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{gw.icon}</span> <span>{gw.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
              {[
                { key: 'COPPER', name: 'Copper', students: '100 Students', price: 'GHS 150', interval: '/month' },
                { key: 'SILVER', name: 'Silver', students: '250 Students', price: 'GHS 300', interval: '/month', popular: true },
                { key: 'GOLD', name: 'Gold', students: '600 Students', price: 'GHS 600', interval: '/month' },
              ].map((tier) => (
                <div
                  key={tier.key}
                  className={`p-5 rounded-2xl border flex flex-col justify-between ${
                    tier.popular
                      ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 bg-white shadow-sm'
                  }`}
                >
                  <div>
                    {tier.popular && (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white mb-2">
                        MOST POPULAR
                      </span>
                    )}
                    <h4 className="font-bold text-base text-slate-900">{tier.name}</h4>
                    <p className="text-xs text-slate-600 mt-1 font-semibold">{tier.students}</p>
                    <div className="mt-3">
                      <span className="text-2xl font-black text-slate-900">{tier.price}</span>
                      <span className="text-xs text-slate-500">{tier.interval}</span>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    <button
                      onClick={() =>
                        handleInitiateCheckout(
                          tier.key,
                          'monthly',
                          selectedCheckoutGateway === 'sandbox',
                          selectedCheckoutGateway
                        )
                      }
                      disabled={checkoutLoading}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      {checkoutLoading && selectedCheckoutPlan === tier.key ? (
                        <span className="animate-spin">⚙️</span>
                      ) : (
                        <span>💳</span>
                      )}
                      <span>
                        {selectedCheckoutGateway === 'sandbox'
                          ? `Instant Sandbox: ${tier.name}`
                          : `Pay via ${selectedCheckoutGateway === 'paystack' ? 'Paystack' : selectedCheckoutGateway === 'flutterwave' ? 'Flutterwave' : 'Stripe'}`}
                      </span>
                    </button>
                    {selectedCheckoutGateway !== 'sandbox' && (
                      <button
                        onClick={() => handleInitiateCheckout(tier.key, 'monthly', true, 'sandbox')}
                        disabled={checkoutLoading}
                        className="w-full py-1.5 rounded-lg text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition"
                      >
                        ⚡ Instant Sandbox Demo
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <span>Need Diamond, Enterprise, or Annual discounts?</span>
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  setActiveTab('subscription');
                }}
                className="text-blue-600 font-bold hover:underline"
              >
                View Full Subscription Page &amp; Receipts ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERDUE SCREEN LOCK PAYWALL OVERLAY (NON-CLOSABLE) */}
      {Boolean(tenant?.subscription?.isExpired || subscriptionData?.statusInfo?.isExpired || tenant?.status === 'SUSPENDED') && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-rose-200 my-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="text-center max-w-xl mx-auto mb-6">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 mb-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                PORTAL TEMPORARILY LOCKED • OVERDUE SUBSCRIPTION
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                {tenant?.name || 'School'} Subscription Due
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                The active license period for this school ended on{' '}
                <strong className="text-slate-900">
                  {tenant?.subscription?.currentPeriodEnd
                    ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'recently'}
                </strong>
                . System access has been temporarily locked until renewal. All student marks, attendance, and fee ledgers are safely preserved.
              </p>
            </div>

            {/* Non-Admin Staff Warning */}
            {user?.role !== 'SUPER_ADMIN' && user?.role !== 'SCHOOL_ADMIN' ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
                <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                  Only School Administrators have permission to renew license tiers.
                  Please notify your Headmaster, Principal, or School Bursar to complete the subscription renewal.
                </p>
                <button
                  onClick={handleSignOut}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition"
                >
                  Sign Out of Account
                </button>
              </div>
            ) : (
              /* Admin Renewal & Paywall Options */
              <div className="space-y-6">
                {/* Billing Cycle Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">Select Renewal Cycle:</span>
                  <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200">
                    <button
                      onClick={() => setPaywallCycle('monthly')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        paywallCycle === 'monthly'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setPaywallCycle('termly')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                        paywallCycle === 'termly'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Termly (4 Mo)</span>
                      <span className="px-1 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-700">
                        -10%
                      </span>
                    </button>
                    <button
                      onClick={() => setPaywallCycle('annual')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                        paywallCycle === 'annual'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Annual (12 Mo)</span>
                      <span className="px-1 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-700">
                        -20%
                      </span>
                    </button>
                  </div>
                </div>

                {/* Plan Choices */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { key: 'COPPER', name: 'Copper', limit: 100, monthly: 150, termly: 540, annual: 1440 },
                    { key: 'SILVER', name: 'Silver', limit: 250, monthly: 300, termly: 1080, annual: 2880, popular: true },
                    { key: 'DIAMOND', name: 'Diamond', limit: 400, monthly: 450, termly: 1620, annual: 4320 },
                    { key: 'GOLD', name: 'Gold', limit: 600, monthly: 600, termly: 2160, annual: 5760 },
                    { key: 'ENTERPRISE', name: 'Enterprise', limit: 2000, monthly: 1200, termly: 4320, annual: 11520 },
                  ].map((p) => {
                    const price = paywallCycle === 'annual' ? p.annual : paywallCycle === 'termly' ? p.termly : p.monthly;
                    const isSelected = selectedPaywallPlan === p.key;

                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelectedPaywallPlan(p.key)}
                        className={`p-3.5 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {p.popular && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white uppercase">
                            POPULAR
                          </span>
                        )}
                        <div>
                          <div className="font-bold text-sm text-slate-900">{p.name}</div>
                          <div className="text-[11px] font-semibold text-blue-600 mt-0.5">
                            {p.limit} Students
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100">
                          <span className="text-base font-black text-slate-900">
                            GHS {price}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            /{paywallCycle === 'annual' ? 'yr' : paywallCycle === 'termly' ? 'term' : 'mo'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Gateway Selector in Overdue Paywall */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-100 rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>💳</span>
                    <span>Select Payment Provider:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'paystack', name: 'Paystack (Ghana MoMo / Cards)', icon: '🟢' },
                      { id: 'flutterwave', name: 'Flutterwave (Pan-Africa)', icon: '🟠' },
                      { id: 'stripe', name: 'Stripe (Cards / Apple Pay)', icon: '🟣' },
                      { id: 'sandbox', name: 'Instant Sandbox Demo', icon: '⚡' },
                    ].map((gw) => (
                      <button
                        key={gw.id}
                        type="button"
                        onClick={() => setSelectedCheckoutGateway(gw.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                          selectedCheckoutGateway === gw.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{gw.icon}</span> <span>{gw.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Payment Action Buttons */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Selected Plan</div>
                    <div className="text-base font-bold text-slate-900">
                      {selectedPaywallPlan} Plan ({paywallCycle}) —{' '}
                      <span className="text-blue-600 font-black">
                        GHS{' '}
                        {getPlanPrice(selectedPaywallPlan, paywallCycle)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() =>
                        handleInitiateCheckout(
                          selectedPaywallPlan,
                          paywallCycle,
                          selectedCheckoutGateway === 'sandbox',
                          selectedCheckoutGateway
                        )
                      }
                      disabled={checkoutLoading}
                      className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                      {checkoutLoading && selectedCheckoutPlan === selectedPaywallPlan ? (
                        <span className="animate-spin">⚙️</span>
                      ) : (
                        <span>💳</span>
                      )}
                      <span>
                        {selectedCheckoutGateway === 'sandbox'
                          ? 'Instant Sandbox Unlock'
                          : `Pay with ${selectedCheckoutGateway === 'paystack' ? 'Paystack' : selectedCheckoutGateway === 'flutterwave' ? 'Flutterwave' : 'Stripe'} & Unlock`}
                      </span>
                    </button>

                    {/* Instant Sandbox Unlock Button for Dev / Staging Verification */}
                    {selectedCheckoutGateway !== 'sandbox' && (
                      <button
                        onClick={() => handleInitiateCheckout(selectedPaywallPlan, paywallCycle, true, 'sandbox')}
                        disabled={checkoutLoading}
                        className="px-4 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition"
                        title="Instant activation without live external payment gateway (Sandbox mode)"
                      >
                        ⚡ Instant Sandbox Unlock
                      </button>
                    )}
                  </div>
                </div>

                {/* Safe Exit */}
                <div className="text-center pt-2">
                  <button
                    onClick={handleSignOut}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
                  >
                    Sign Out as {user?.email || 'User'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OFFICIAL PAYMENT RECEIPT MODAL */}
      {receiptModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🧾</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Subscription Tax Invoice &amp; Receipt</h3>
                  <p className="text-[11px] text-slate-400">Official proof of SaaS platform license</p>
                </div>
              </div>
              <button
                onClick={() => setReceiptModalSub(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Receipt Content */}
            <div className="py-5 space-y-4 text-xs" id="printable-receipt">
              {/* School Header */}
              <div className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <div className="font-bold text-sm text-slate-900">{tenant?.name || 'School Name'}</div>
                  <div className="text-slate-500 font-mono text-[11px]">{tenant?.subdomain}.smsapp.com</div>
                  <div className="text-slate-500 text-[11px]">{tenant?.email || user?.email}</div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                    PAID &amp; VERIFIED
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Ref: {receiptModalSub.gatewayReference || receiptModalSub.id.slice(0, 14)}
                  </div>
                </div>
              </div>

              {/* Details table */}
              <div className="space-y-2.5 border-y border-slate-100 py-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subscription Tier</span>
                  <span className="font-bold text-slate-900">{receiptModalSub.plan} Plan ({receiptModalSub.studentLimit} Students)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Billing Interval</span>
                  <span className="font-bold text-slate-900 capitalize">{receiptModalSub.billingCycle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Period Covered</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(receiptModalSub.currentPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' — '}
                    {new Date(receiptModalSub.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Gateway</span>
                  <span className="font-mono text-slate-800 uppercase">{receiptModalSub.paymentGateway}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Issued On</span>
                  <span className="text-slate-800">{new Date(receiptModalSub.createdAt).toLocaleString('en-GB')}</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center text-sm pt-1">
                <span className="font-bold text-slate-900">Total Amount Paid</span>
                <span className="font-black text-xl text-emerald-700">
                  {receiptModalSub.currency} {Number(receiptModalSub.amount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Receipt Actions */}
            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span>
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setReceiptModalSub(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BILLING ITEM MODAL */}
      {showCreateItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New Fee Item</h3>
                <p className="text-xs text-slate-500">Define a billable fee charge (e.g. Tuition, Sports, PTA).</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateItemModal(false);
                  setItemError('');
                }}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {itemError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {itemError}
              </div>
            )}

            <form onSubmit={handleCreateBillingItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newItemForm.item}
                  onChange={(e) => setNewItemForm({ ...newItemForm, item: e.target.value })}
                  placeholder="e.g. Tuition Fee, Bed User Fee, Exam Fee"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount ({tenant?.currency || 'GHS'}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newItemForm.amount}
                    onChange={(e) => setNewItemForm({ ...newItemForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={newItemForm.status}
                    onChange={(e) => setNewItemForm({ ...newItemForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newItemForm.description}
                  onChange={(e) => setNewItemForm({ ...newItemForm, description: e.target.value })}
                  placeholder="Additional details about this billing item..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateItemModal(false);
                    setItemError('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createItemLoading}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {createItemLoading ? 'Saving...' : 'Save Fee Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BILLING CATEGORY MODAL */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Billing Category</h3>
                <p className="text-xs text-slate-500">
                  Bundle individual fee items into a package assigned to a grade level or student category.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateCategoryModal(false);
                  setCategoryError('');
                }}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {categoryError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {categoryError}
              </div>
            )}

            <form onSubmit={handleCreateBillingCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCategoryForm.name}
                  onChange={(e) => setNewCategoryForm({ ...newCategoryForm, name: e.target.value })}
                  placeholder="e.g. Primary, JHS, Nursery, Kindergarten, SHS 1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={newCategoryForm.academicYear}
                    onChange={(e) => setNewCategoryForm({ ...newCategoryForm, academicYear: e.target.value })}
                    placeholder={stats?.activeYear || ''}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Term</label>
                  <select
                    value={newCategoryForm.term}
                    onChange={(e) => setNewCategoryForm({ ...newCategoryForm, term: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                  </select>
                </div>
              </div>

              {/* Bundled Fee Items Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Select Fee Items to Bundle
                  </label>
                  <span className="text-[11px] font-medium text-slate-500">
                    {selectedItemNames.length} selected
                  </span>
                </div>

                {billingItems.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    No fee items found. Please add fee items in the "Fee Items" tab first so you can bundle them.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-xl space-y-1.5 bg-slate-50/50">
                    {billingItems.map((item) => {
                      const isChecked = selectedItemNames.includes(item.item);
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                            isChecked
                              ? 'bg-blue-50 border border-blue-200 font-semibold text-blue-900'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItemNames([...selectedItemNames, item.item]);
                                } else {
                                  setSelectedItemNames(selectedItemNames.filter((name) => name !== item.item));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span>{item.item}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({item.billingId})</span>
                          </div>
                          <span className="font-bold text-slate-900">
                            {tenant?.currency || 'GHS'} {Number(item.amount).toFixed(2)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Live Calculated Category Total */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-900">Calculated Category Total</p>
                  <p className="text-[11px] text-blue-600">Sum of selected fee items</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-blue-700">
                    {tenant?.currency || 'GHS'}{' '}
                    {billingItems
                      .filter((bi) => selectedItemNames.includes(bi.item))
                      .reduce((sum, bi) => sum + Number(bi.amount || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description (Optional)</label>
                <input
                  type="text"
                  value={newCategoryForm.description}
                  onChange={(e) => setNewCategoryForm({ ...newCategoryForm, description: e.target.value })}
                  placeholder="e.g. Standard billing package for all primary pupils"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCategoryModal(false);
                    setCategoryError('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategoryLoading}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {createCategoryLoading ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SYSTEM PARAMETER MODAL */}
      {showEditParamModal && editingParam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit System Parameter</h3>
              <button
                onClick={() => {
                  setShowEditParamModal(false);
                  setEditingParam(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveParam} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Parameter Name
                </label>
                <input
                  type="text"
                  disabled
                  value={editingParam.param}
                  className="w-full px-3.5 py-2 bg-slate-100 text-slate-700 font-mono text-xs rounded-xl border border-slate-200 cursor-not-allowed"
                />
              </div>

              {editingParam.category && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {editingParam.category}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Value <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={editParamValue}
                  onChange={(e) => setEditParamValue(e.target.value)}
                  placeholder="Enter parameter value"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditParamModal(false);
                    setEditingParam(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editParamLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {editParamLoading ? 'Saving...' : 'Save Parameter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT SYSTEM LIST ITEM MODAL */}
      {showListModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {listModalOldValue ? 'Edit' : 'Add'}{' '}
                {listModalType === 'categories' ? 'Fee Category' : 'Payment Method'}
              </h3>
              <button
                onClick={() => {
                  setShowListModal(false);
                  setListModalInputValue('');
                  setListModalOldValue(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveListItem} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {listModalType === 'categories' ? 'Category Name' : 'Payment Method Name'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={listModalInputValue}
                  onChange={(e) => setListModalInputValue(e.target.value)}
                  placeholder={
                    listModalType === 'categories'
                      ? 'e.g. Laboratory Fee, Transport, Graduation'
                      : 'e.g. Bank Transfer, POS Terminal, Cheque'
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowListModal(false);
                    setListModalInputValue('');
                    setListModalOldValue(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={listModalLoading || !listModalInputValue.trim()}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {listModalLoading ? 'Saving...' : listModalOldValue ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportStudentsModal
        showModal={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportPayload('');
          setImportResult(null);
        }}
        importPayload={importPayload}
        setImportPayload={setImportPayload}
        importLoading={importLoading}
        importResult={importResult}
        importTemplate={importTemplate}
        onSubmit={handleStudentImport}
        onFileUpload={handleExcelUpload}
        onDownloadTemplate={handleDownloadTemplate}
      />
    </div>
  );
}
