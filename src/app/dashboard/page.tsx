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

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'classes' | 'billing' | 'migration' | 'settings'>('overview');

  // Stats & Students state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & UI states
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [testMode, setTestMode] = useState(false);

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

  // Fetch stats and students once token is loaded
  useEffect(() => {
    if (!token) return;
    fetchDashboardData();
  }, [token]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, studentsRes] = await Promise.all([
        fetch('/api/dashboard/stats', {
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-blue-500/20">
              🏫
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">
                  {tenant?.name || 'School Dashboard'}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {tenant?.subdomain}.smsapp.com
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Academic Year: <span className="font-semibold text-slate-700">{stats?.activeYear || '2026/2027'}</span> • {stats?.currentTerm || 'Term 1'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Plan Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <span className="font-bold">Plan:</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-semibold">
                {tenant?.plan || 'DEMO'}
              </span>
              <span>({stats?.studentCount || 0}/{tenant?.studentLimit || 15} Students)</span>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="ml-1 text-xs text-blue-700 font-bold hover:underline"
              >
                Upgrade
              </button>
            </div>

            {/* Test Mode Indicator */}
            {testMode && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                ⚡ TEST MODE ACTIVE
              </span>
            )}

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold">
                  {user?.fullName ? user.fullName[0].toUpperCase() : 'A'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-slate-800">{user?.fullName || 'School Admin'}</div>
                  <div className="text-[10px] text-slate-500">{user?.email || 'admin@school.com'}</div>
                </div>
                <span className="text-xs text-slate-400">▼</span>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user?.fullName || 'Administrator'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      {user?.role || 'SCHOOL_ADMIN'}
                    </span>
                  </div>

                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Test Mode</p>
                      <p className="text-[10px] text-slate-500">Override limits for testing</p>
                    </div>
                    <button
                      onClick={() => setTestMode(!testMode)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        testMode ? 'bg-amber-500' : 'bg-slate-200'
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
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    ⚙️ School Settings
                  </button>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setShowUpgradeModal(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    💳 Subscription Billing
                  </button>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <aside className="w-full md:w-64 shrink-0 space-y-1">
          {[
            { id: 'overview', icon: '📊', label: 'Overview' },
            { id: 'students', icon: '🎓', label: 'Students Directory' },
            { id: 'classes', icon: '🏫', label: 'Classes & Subjects' },
            { id: 'billing', icon: '💳', label: 'Billing & MoMo' },
            { id: 'migration', icon: '🔄', label: 'Sheets Migration' },
            { id: 'settings', icon: '⚙️', label: 'Settings & Quota' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}

          {/* Quota Progress Card in Sidebar */}
          <div className="mt-6 p-4 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Student Quota</span>
              <span>
                {stats?.studentCount || 0} / {tenant?.studentLimit || 15}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
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
            <p className="text-[11px] text-slate-500 mb-3">
              {(tenant?.studentLimit || 15) - (stats?.studentCount || 0)} student slots remaining on {tenant?.plan || 'DEMO'}.
            </p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="w-full py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition"
            >
              Upgrade Plan
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.fullName || 'Administrator'} 👋</h1>
                  <p className="text-sm text-slate-500">Here is the current operational summary for {tenant?.name}.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowEnrollModal(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition flex items-center gap-2"
                  >
                    <span>➕</span> Enroll Student
                  </button>
                  <button
                    onClick={() => setActiveTab('migration')}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
                  >
                    Import Sheets Data
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🎓</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {tenant?.plan || 'DEMO'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl font-extrabold text-slate-900">{stats?.studentCount || 0}</div>
                    <div className="text-xs text-slate-500">Total Enrolled Students</div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    Cap: {tenant?.studentLimit || 15} max students
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🏫</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl font-extrabold text-slate-900">{stats?.classCount || 0}</div>
                    <div className="text-xs text-slate-500">Classrooms Configured</div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {stats?.subjectCount || 0} subjects taught
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">📅</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      Current
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-extrabold text-slate-900">{stats?.activeYear || '2026/2027'}</div>
                    <div className="text-xs text-slate-500">{stats?.currentTerm || 'Term 1'}</div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">Academic Calendar Active</div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">💳</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {tenant?.currency || 'GHS'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl font-extrabold text-slate-900">{stats?.billingCategoryCount || 3}</div>
                    <div className="text-xs text-slate-500">Fee Categories Setup</div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">Tuition, PTA & Books</div>
                </div>
              </div>

              {/* Recent Students Table Preview */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Enrolled Students</h2>
                    <p className="text-xs text-slate-500">Recent admissions registered in {tenant?.name}.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('students')}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    View All Students →
                  </button>
                </div>

                {students.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
                    <span className="text-3xl">📝</span>
                    <p className="text-sm font-semibold text-slate-700 mt-2">No students enrolled yet</p>
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
                      <thead className="bg-slate-50 text-slate-600 uppercase border-y border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Student ID</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Gender</th>
                          <th className="py-2.5 px-3">Guardian</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.slice(0, 5).map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{s.studentId}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{s.firstName} {s.lastName}</td>
                            <td className="py-2.5 px-3 text-slate-600">{s.gender || '—'}</td>
                            <td className="py-2.5 px-3 text-slate-600">{s.guardianName || '—'}</td>
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
                    Tuition fees, PTA dues, and Mobile Money collections in {tenant?.currency || 'GHS'}.
                  </p>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm"
                >
                  Manage SaaS Subscription
                </button>
              </div>

              {/* Billing Categories Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200">
                <h2 className="font-bold text-base text-slate-900 mb-3">Standard Fee Categories</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { name: 'Tuition Fee', amount: 'GHS 250.00', desc: 'Per student per academic term' },
                    { name: 'PTA Dues', amount: 'GHS 30.00', desc: 'Parent Teacher Association levy' },
                    { name: 'Books & Supplies', amount: 'GHS 100.00', desc: 'Curriculum texts & study guides' },
                  ].map((cat, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="font-bold text-sm text-slate-900">{cat.name}</div>
                      <div className="text-lg font-extrabold text-blue-600 mt-1">{cat.amount}</div>
                      <div className="text-xs text-slate-500 mt-1">{cat.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
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
        </main>
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
    </div>
  );
}
