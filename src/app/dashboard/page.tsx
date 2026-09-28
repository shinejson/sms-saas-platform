'use client';

import React, { useState, useEffect } from 'react';

interface TenantInfo {
  id: string;
  name: string;
  alias?: string;
  subdomain: string;
  currency?: string;
  plan: string;
  studentLimit: number;
  logoUrl?: string;
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

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Stats & Students state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter and Analytics States
  const [availableYears, setAvailableYears] = useState<AcademicYearOption[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('All Terms');
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-25');
  const [darkMode, setDarkMode] = useState(false);

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

  // On mount: authenticate from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('sms_token');
    const savedTenant = localStorage.getItem('sms_tenant');
    const savedUser = localStorage.getItem('sms_user');

    if (!savedToken) {
      window.location.href = '/';
      return;
    }

    setToken(savedToken);
    if (savedTenant) {
      try {
        setTenant(JSON.parse(savedTenant));
      } catch (e) {
        console.error(e);
      }
    }
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Fetch stats, students, and billing data once token is loaded
  useEffect(() => {
    if (!token) return;
    fetchDashboardData();
    fetchBillingData();
  }, [token]);

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
          academicYear: newCategoryForm.academicYear || stats?.activeYear || '2025/2026',
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

  // SVG Chart 1: Payment Status by Class (Paid in Green #10b981 vs Unpaid in Red #ef4444)
  const renderPaymentStatusChart = () => {
    const items =
      paymentStatusData.length > 0
        ? paymentStatusData
        : [
            { className: 'Class 1', paidStudents: 0, unpaidStudents: 1 },
            { className: 'Class 3', paidStudents: 0, unpaidStudents: 0 },
            { className: 'Unassigned', paidStudents: 0, unpaidStudents: 0 },
          ];

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
    const trendPoints =
      attendanceTrendData.length > 2
        ? attendanceTrendData
        : [
            { label: 'Sep 20', percentage: 0 },
            { label: 'Sep 21', percentage: 0 },
            { label: 'Sep 22', percentage: 0 },
            { label: 'Sep 23', percentage: 0 },
            { label: 'Sep 24', percentage: 0 },
            { label: 'Sep 25', percentage: 0 },
          ];

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
        : [
            { className: 'Class 1', studentCount: 1 },
            { className: 'Class 3', studentCount: 1 },
            { className: 'Unassigned', studentCount: 0 },
          ];

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

  const handleSignOut = () => {
    localStorage.removeItem('sms_token');
    localStorage.removeItem('sms_tenant');
    localStorage.removeItem('sms_user');
    window.location.href = '/';
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      (s.guardianName && s.guardianName.toLowerCase().includes(q))
    );
  });

  const userInitials = user?.fullName

    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AS';

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} flex font-sans transition-colors duration-200`}>

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
        {/* Top Header: Logo + School Name */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-[#1e293b] border border-blue-900/40 flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0">
              {tenant?.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-700 border-2 border-white/90 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 2h2v7h7v2h-7v11h-2V11H4V9h7V2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <h2 className="font-black text-base text-slate-900 tracking-tight truncate uppercase">
                {tenant?.name || 'GEBSCO'}
              </h2>
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

          {/* PEOPLE */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100 mb-2 px-1">
              PEOPLE
            </div>
            <div className="space-y-0.5">
              {[
                { id: 'students', label: 'Students', Icon: StudentsIcon },
                { id: 'teachers', label: 'Teachers', Icon: TeachersIcon },
                { id: 'users', label: 'Users', Icon: UsersIcon },
                { id: 'parents', label: 'Parents', Icon: ParentsIcon },
                { id: 'permissions', label: 'Permissions', Icon: PermissionsIcon },
              ].map(({ id, label, Icon }) => {
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
            </div>
          </div>

          {/* ACADEMICS */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100 mb-2 px-1">
              ACADEMICS
            </div>
            <div className="space-y-0.5">
              {[
                { id: 'classes', label: 'Classes', Icon: ClassesIcon },
                { id: 'subjects', label: 'Subject', Icon: SubjectIcon },
                { id: 'enrollments', label: 'Enrollments', Icon: EnrollmentsIcon },
                { id: 'attendance', label: 'Attendance', Icon: AttendanceIcon },
                { id: 'academic-years', label: 'Academic Years', Icon: AcademicYearsIcon },
                { id: 'performance', label: 'Performance', Icon: PerformanceIcon },
              ].map(({ id, label, Icon }) => {
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
            </div>
          </div>

          {/* FINANCE */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100 mb-2 px-1">
              FINANCE
            </div>
            <div className="space-y-0.5">
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
            </div>
          </div>

          {/* SYSTEM */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100 mb-2 px-1">
              SYSTEM
            </div>
            <div className="space-y-0.5">
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
            </div>
          </div>
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
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Upgrade ↗
              </button>
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
              {/* Search Bar */}
              <div className="relative hidden md:block">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-40 lg:w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
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
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition active:scale-95 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Toggle Theme"
              >
                <span>{darkMode ? '☀️ Light' : '🌙 Dark'}</span>
              </button>

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
              <div className="relative">
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
                    {user?.fullName || 'Appeanin Silas'}
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
                        setShowUpgradeModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-500/10"
                    >
                      💳 Subscription Billing
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
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
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
                    <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      Academic Year
                    </label>
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
                      ) : (
                        <option value={stats?.activeYear || 'Mukaila 2026/2027'}>
                          {stats?.activeYear || 'Mukaila 2026/2027'} (Active)
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
                      {kpis?.totalInvoices ?? (quickInsights?.invoicesCount || 1)}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      {quickInsights?.unpaidInvoices ?? 1} unpaid
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
                      {selectedTerm} · {selectedYear || stats?.activeYear || 'Mukaila 2026/2027'}
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
                      {quickInsights?.invoicesCount ?? (stats?.billingCategoryCount ? 1 : 0)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">
                      <span className="text-emerald-600 font-semibold">{quickInsights?.paidInvoices || 0} paid</span>
                      {' · '}
                      <span className="text-amber-600 font-semibold">{quickInsights?.partialInvoices || 0} partial</span>
                      {' · '}
                      <span className="text-red-500 font-semibold">{quickInsights?.unpaidInvoices || 1} unpaid</span>
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
                        {quickInsights?.outstandingPercentage || 100}% outstanding
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
                    <button
                      onClick={() => setShowEnrollModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5"
                    >
                      <span>➕</span> Enroll Student
                    </button>
                    <button
                      onClick={() => setActiveTab('students')}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View All Students →
                    </button>
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
                    <button
                      onClick={() => setShowEnrollModal(true)}
                      className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                    >
                      Enroll First Student
                    </button>
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
                <button
                  onClick={() => setShowEnrollModal(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition flex items-center gap-2 self-start"
                >
                  <span>➕</span> Enroll Student
                </button>
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
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Classes & Subjects</h1>
                <p className="text-sm text-slate-500">Configure academic grades, classrooms, and subject allocations.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl bg-white border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-base text-slate-900">Classrooms</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {stats?.classCount || 0} Classes
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Import existing classes from your Google Sheet or create new class rosters.
                  </p>
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="w-full py-2.5 rounded-xl border border-dashed border-blue-400 text-blue-600 text-xs font-bold hover:bg-blue-50 transition"
                  >
                    Sync Classes from Google Sheets
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-base text-slate-900">Curriculum Subjects</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      {stats?.subjectCount || 0} Subjects
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Academic subjects assigned to teachers for grading and report cards.
                  </p>
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="w-full py-2.5 rounded-xl border border-dashed border-purple-400 text-purple-600 text-xs font-bold hover:bg-purple-50 transition"
                  >
                    Sync Subjects from Google Sheets
                  </button>
                </div>
              </div>
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
                    <button
                      onClick={() => setShowCreateItemModal(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5"
                    >
                      <span>➕</span> Add Fee Item
                    </button>
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
                                <button
                                  onClick={() => setShowCreateItemModal(true)}
                                  className="mt-3 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                >
                                  + Create First Fee Item
                                </button>
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
                                  <button
                                    onClick={() => handleDeleteBillingItem(item.id)}
                                    className="p-1 text-red-500 hover:text-red-700 text-xs font-bold"
                                    title="Delete item"
                                  >
                                    🗑️
                                  </button>
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
                    <button
                      onClick={() => {
                        setShowCreateCategoryModal(true);
                        setSelectedItemNames([]);
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5"
                    >
                      <span>➕</span> Create Billing Category
                    </button>
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
                                <button
                                  onClick={() => {
                                    setShowCreateCategoryModal(true);
                                    setSelectedItemNames([]);
                                  }}
                                  className="mt-3 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                >
                                  + Create First Category
                                </button>
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
                                  <button
                                    onClick={() => handleDeleteBillingCategory(cat.id)}
                                    className="p-1 text-red-500 hover:text-red-700 text-xs font-bold"
                                    title="Delete category"
                                  >
                                    🗑️
                                  </button>
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

                  <button
                    type="submit"
                    disabled={migrationLoading}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
                  >
                    {migrationLoading ? 'Migrating Database...' : 'Run Migration Now'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">School Profile & Quota Settings</h1>
                <p className="text-sm text-slate-500">School information, subdomain configurations, and license parameters.</p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">School Name</span>
                  <span className="font-bold text-slate-900">{tenant?.name}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">Subdomain</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {tenant?.subdomain}.smsapp.com
                  </span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">Currency</span>
                  <span className="font-bold text-slate-900">{tenant?.currency || 'GHS'}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">Subscription Tier</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {tenant?.plan || 'DEMO'}
                  </span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">Student Capacity</span>
                  <span className="font-bold text-slate-900">{tenant?.studentLimit || 15} Students</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TEACHERS */}
          {activeTab === 'teachers' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Teachers & Faculty Directory</h1>
                  <p className="text-sm text-slate-500">Manage teaching staff, assigned courses, and contact information for {tenant?.name}.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveTab('migration')} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition flex items-center gap-2 shadow-sm">
                    <span>🔄</span> Import Teachers from Google Sheets
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  👨‍🏫
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Staff & Teachers Management</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Your Neon PostgreSQL table <code className="bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">Teacher</code> is active and multi-tenant isolated. You can sync teaching staff records from your Google Sheets "Teachers" tab or assign classes.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveTab('migration')} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                    Sync Sheets Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">System Users & Roles</h1>
                  <p className="text-sm text-slate-500">Administrators, Teachers, Accountants, and Staff accounts with access to {tenant?.name}.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  👥
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">User Directory & Roles</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Connected to <code className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">User</code> table in Neon DB. Supports multi-role access control for School Admins, Bursars, and Instructors.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveTab('migration')} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition">
                    Sync Users from Sheets
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PARENTS */}
          {activeTab === 'parents' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Parents & Guardians</h1>
                  <p className="text-sm text-slate-500">Contact information, emergency details, and student billing linkages.</p>
                </div>
                <button onClick={() => setActiveTab('migration')} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                  🔄 Import Parents
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  👪
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Guardian Database</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Connected to <code className="bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold">Parent</code> table in Neon DB. Facilitates MoMo fee reminder SMS and pupil progress report delivery.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveTab('migration')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition">
                    Import from Sheets
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Role & Permission Matrix</h1>
                  <p className="text-sm text-slate-500">Granular access control policies and permission assignments.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  🛡️
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Permission Control Matrix</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Synced with <code className="bg-slate-100 text-purple-700 px-1.5 py-0.5 rounded font-mono font-bold">Permission</code> table in Neon PostgreSQL. Enforces multi-tenant data boundaries.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SUBJECTS */}
          {activeTab === 'subjects' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Subjects & Curriculum</h1>
                  <p className="text-sm text-slate-500">Manage courses and instructional subjects taught across grade levels.</p>
                </div>
                <button onClick={() => setActiveTab('classes')} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                  View Classes & Subjects
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  📚
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Course & Curriculum Directory</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Synced with <code className="bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">Subject</code> model in Neon DB. Manage core subjects like Mathematics, English Language, Integrated Science, and ICT.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveTab('classes')} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                    Go to Classes & Subjects
                  </button>
                </div>
              </div>
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
                <button onClick={() => setShowEnrollModal(true)} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                  ➕ Enroll Student
                </button>
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
                  <button onClick={() => setActiveTab('students')} className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition">
                    View Enrolled Students ({stats?.studentCount || 0})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Daily Attendance Register</h1>
                  <p className="text-sm text-slate-500">Record daily student attendance, roll calls, and automated absence reports.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  ✅
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Daily Attendance Tracking</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Synced with <code className="bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold">Attendance</code> table in Neon DB. Monitor student presence and calculate termly attendance percentages.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveTab('migration')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition">
                    Import Attendance Records
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ACADEMIC YEARS */}
          {activeTab === 'academic-years' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Academic Years & Terms</h1>
                  <p className="text-sm text-slate-500">Configure academic sessions, terms, semester dates, and holiday calendars.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Active Session: {stats?.activeYear || '2026/2027'}</h3>
                    <p className="text-xs text-slate-500">Current Term: {stats?.currentTerm || 'Term 1'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    🟢 CURRENT SESSION
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Synced with <code className="bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">AcademicYear</code> table in Neon PostgreSQL.
                </p>
              </div>
            </div>
          )}

          {/* TAB: PERFORMANCE */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Assessment & Performance</h1>
                  <p className="text-sm text-slate-500">Class continuous assessments (30%), terminal exams (70%), grades, and pupil rankings.</p>
                </div>
                <button onClick={() => setActiveTab('migration')} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                  🔄 Import Exam Scores
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  📈
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Continuous Assessment & Grading</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Synced with <code className="bg-slate-100 text-amber-700 px-1.5 py-0.5 rounded font-mono font-bold">Performance</code> table in Neon DB. Supports terminal report card generation.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveTab('migration')} className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition">
                    Sync Assessment Scores
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INVOICES */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Student Invoices</h1>
                  <p className="text-sm text-slate-500">Generated termly fee bills, outstanding student balances, and payment due dates.</p>
                </div>
                <button onClick={() => { setActiveTab('billing'); setBillingSubTab('categories'); }} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                  Manage Fee Packages
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  🧾
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Fee Invoices & Billing Engine</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Synced with <code className="bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">Invoice</code> table in Neon DB. Auto-generates student fee demands based on their Billing Category.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => { setActiveTab('billing'); setBillingSubTab('items'); }} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition">
                    View Fee Items
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Mobile Money & Card Payments</h1>
                  <p className="text-sm text-slate-500">Collected student fees via MTN MoMo, Telecel Cash, Bank Deposit, and Cash.</p>
                </div>
                <button onClick={() => setShowUpgradeModal(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition">
                  💳 Payment Gateway Status
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                  💳
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Fee Collections & Receipts</h3>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
                    Synced with <code className="bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold">Payment</code> table in Neon DB. Paystack integration automatically records Mobile Money transactions.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => { setActiveTab('billing'); setBillingSubTab('items'); }} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition">
                    Configure Billing Rates
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">School Analytics & Reports</h1>
                  <p className="text-sm text-slate-500">Generate pupil progress reports, fee debtor ledgers, and enrollment statistics.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <span className="text-2xl">📊</span>
                  <h4 className="font-bold text-slate-900 text-sm">Enrollment Report</h4>
                  <p className="text-xs text-slate-500">Total active students: {stats?.studentCount || 0}</p>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <span className="text-2xl">💰</span>
                  <h4 className="font-bold text-slate-900 text-sm">Financial Summary</h4>
                  <p className="text-xs text-slate-500">Configured Fee Packages: {billingCategories.length}</p>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <span className="text-2xl">🏫</span>
                  <h4 className="font-bold text-slate-900 text-sm">Academic Stream</h4>
                  <p className="text-xs text-slate-500">Configured Classes: {stats?.classCount || 0}</p>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* SAAS PLATFORM FOOTER MAINTAINED */}
        <footer className="mt-auto bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 space-y-1">
          <p>© 2026 {tenant?.name || 'SMS Platform'} • Multi-Tenant School Management Platform</p>
          <p className="text-slate-400">Built for Ghanaian Basic & Senior High Schools • Supports MTN MoMo, Telecel Cash & Card Payments</p>
        </footer>
      </div>

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

      {/* UPGRADE PLAN MODAL */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Upgrade Your School Subscription</h3>
                <p className="text-xs text-slate-500">Instant unlock of student caps with Mobile Money (MTN MoMo, Telecel) or Card.</p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
              {[
                { name: 'Copper', students: '100 Students', price: 'GHS 150', interval: '/month' },
                { name: 'Silver', students: '250 Students', price: 'GHS 300', interval: '/month', popular: true },
                { name: 'Gold', students: '600 Students', price: 'GHS 600', interval: '/month' },
              ].map((tier, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    tier.popular ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div>
                    {tier.popular && (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white mb-2">
                        MOST POPULAR
                      </span>
                    )}
                    <h4 className="font-bold text-base text-slate-900">{tier.name}</h4>
                    <p className="text-xs text-slate-600 mt-1 font-semibold">{tier.students}</p>
                    <div className="mt-3">
                      <span className="text-2xl font-extrabold text-slate-900">{tier.price}</span>
                      <span className="text-xs text-slate-500">{tier.interval}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      alert(`Initiating Paystack checkout for ${tier.name} plan (${tier.price}). MoMo prompt will appear on your phone.`);
                    }}
                    className="mt-4 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
                  >
                    Pay with MoMo / Card
                  </button>
                </div>
              ))}
            </div>

            <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
              Need more than 600 students? Contact support for our Enterprise tier with dedicated cloud storage.
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
                    placeholder={stats?.activeYear || '2025/2026'}
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
    </div>
  );
}
