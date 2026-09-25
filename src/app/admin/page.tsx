'use client';

import React, { useState, useEffect } from 'react';

interface TenantItem {
  id: string;
  name: string;
  alias?: string;
  subdomain: string;
  currency?: string;
  plan: 'DEMO' | 'COPPER' | 'SILVER' | 'DIAMOND' | 'GOLD' | 'ENTERPRISE';
  studentLimit: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  _count: {
    students: number;
    users: number;
    classes?: number;
  };
}

interface SuperAdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  tenant?: {
    name: string;
    subdomain: string;
  };
}

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalStudents: number;
  totalUsers: number;
  estimatedMRR: number;
  planDistribution: Record<string, number>;
  recentTenants: Array<{
    id: string;
    name: string;
    subdomain: string;
    plan: string;
    status: string;
    studentLimit: number;
    createdAt: string;
    _count: {
      students: number;
      users: number;
    };
  }>;
}

const PLAN_TIERS = [
  { name: 'DEMO', label: 'Free Demo', price: 0, defaultLimit: 15 },
  { name: 'COPPER', label: 'Copper Plan', price: 150, defaultLimit: 100 },
  { name: 'SILVER', label: 'Silver Plan', price: 300, defaultLimit: 250 },
  { name: 'DIAMOND', label: 'Diamond Plan', price: 450, defaultLimit: 400 },
  { name: 'GOLD', label: 'Gold Plan', price: 600, defaultLimit: 600 },
  { name: 'ENTERPRISE', label: 'Enterprise Plan', price: 1200, defaultLimit: 2000 },
];

export default function AdminPortal() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; fullName: string; role: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'revenue' | 'admins' | 'diagnostics'>('overview');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [admins, setAdmins] = useState<SuperAdminUser[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Edit Tenant Modal
  const [editingTenant, setEditingTenant] = useState<TenantItem | null>(null);
  const [editPlan, setEditPlan] = useState<string>('DEMO');
  const [editLimit, setEditLimit] = useState<number>(15);
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [editName, setEditName] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);

  // Create Super Admin Modal
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminModalError, setAdminModalError] = useState('');

  // Check initial session
  useEffect(() => {
    const savedToken = localStorage.getItem('sms_token');
    const savedUserStr = localStorage.getItem('sms_user');

    if (savedToken && savedUserStr) {
      try {
        const parsedUser = JSON.parse(savedUserStr);
        if (parsedUser.role === 'SUPER_ADMIN') {
          setToken(savedToken);
          setCurrentUser(parsedUser);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Session error:', e);
      }
    }
    setCheckingAuth(false);
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchAllData();
    }
  }, [isAuthenticated, token]);

  const fetchAllData = async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      const [statsRes, tenantsRes, adminsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/tenants', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        setTenants(tenantsData.tenants);
      }
      if (adminsRes.ok) {
        const adminsData = await adminsRes.json();
        setAdmins(adminsData.admins);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      if (data.user.role !== 'SUPER_ADMIN') {
        throw new Error('Access Denied: This account does not have SUPER_ADMIN / Platform Owner privileges.');
      }

      localStorage.setItem('sms_token', data.token);
      localStorage.setItem('sms_user', JSON.stringify(data.user));
      localStorage.setItem('sms_tenant', JSON.stringify(data.tenant));

      setToken(data.token);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('sms_token');
    localStorage.removeItem('sms_user');
    localStorage.removeItem('sms_tenant');
    setToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleOpenEdit = (t: TenantItem) => {
    setEditingTenant(t);
    setEditPlan(t.plan);
    setEditLimit(t.studentLimit);
    setEditStatus(t.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
    setEditName(t.name);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant || !token) return;

    setSavingTenant(true);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingTenant.id,
          name: editName,
          plan: editPlan,
          studentLimit: Number(editLimit),
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update school tenant');

      setFeedbackMsg(`✅ School "${editName}" updated successfully!`);
      setEditingTenant(null);
      fetchAllData();
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err: any) {
      alert(`Error updating school: ${err.message}`);
    } finally {
      setSavingTenant(false);
    }
  };

  const handleImpersonate = async (tenantId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/impersonate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to impersonate school');

      // Store impersonation session and launch dashboard in new tab
      sessionStorage.setItem('sms_impersonate_backup_token', token);
      localStorage.setItem('sms_token', data.token);
      localStorage.setItem('sms_tenant', JSON.stringify(data.tenant));
      localStorage.setItem('sms_user', JSON.stringify(data.user));

      window.open('/dashboard', '_blank');
    } catch (err: any) {
      alert(`Impersonation failed: ${err.message}`);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreatingAdmin(true);
    setAdminModalError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: newAdminName,
          email: newAdminEmail,
          password: newAdminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create Super Admin');

      setFeedbackMsg(`🎉 Super Admin "${newAdminEmail}" created successfully!`);
      setShowAddAdminModal(false);
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      fetchAllData();
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (err: any) {
      setAdminModalError(err.message);
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Filtered tenants list
  const filteredTenants = tenants.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      t.name.toLowerCase().includes(q) ||
      t.subdomain.toLowerCase().includes(q) ||
      (t.alias && t.alias.toLowerCase().includes(q));

    const matchesPlan = planFilter === 'ALL' || t.plan === planFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

    return matchesQuery && matchesPlan && matchesStatus;
  });

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-spin text-3xl">⏳</div>
      </div>
    );
  }

  // --- UNAUTHENTICATED / LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center items-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900/90 border border-indigo-900/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-indigo-500/25 mb-4">
              👑
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">SMS Global SaaS</h1>
            <p className="text-sm text-indigo-300 font-medium mt-1">Platform Owner & Super Admin Portal</p>
          </div>

          {loginError && (
            <div className="p-3.5 mb-6 rounded-xl bg-red-950/80 border border-red-700/60 text-red-200 text-xs font-semibold leading-relaxed">
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Super Admin Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@smsapp.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 mt-2"
            >
              {loginLoading ? 'Verifying Super Admin...' : 'Authenticate as Platform Owner'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <a
              href="/"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition font-medium"
            >
              ← Return to Main School Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED PLATFORM OWNER DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">SMS Global Cloud</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  SUPER ADMIN PORTAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Master Platform Operations & Multi-Tenant Management</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              <span>🏫</span> View School Dashboard
            </a>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white">{currentUser?.fullName}</div>
                <div className="text-[10px] text-indigo-400">{currentUser?.email}</div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800/40 text-red-300 hover:bg-red-900/60 text-xs font-semibold transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-sm font-semibold flex items-center justify-between">
            <span>{feedbackMsg}</span>
            <button onClick={() => setFeedbackMsg('')} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Schools</span>
              <span className="text-xl">🏫</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{stats?.totalTenants ?? '—'}</span>
              <span className="text-xs font-semibold text-emerald-400">
                ({stats?.activeTenants ?? 0} Active)
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {stats?.suspendedTenants ?? 0} suspended accounts
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Students</span>
              <span className="text-xl">🎓</span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-white">{stats?.totalStudents ?? '—'}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Platform-wide enrolled students</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Est. Monthly Revenue</span>
              <span className="text-xl">💳</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-emerald-400">
                GHS {stats?.estimatedMRR ? stats.estimatedMRR.toLocaleString() : '0'}
              </span>
              <span className="text-xs text-slate-400">/ mo</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">From active subscription tiers</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Staff & Teachers</span>
              <span className="text-xl">👥</span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-white">{stats?.totalUsers ?? '—'}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Total staff accounts created</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          {[
            { id: 'overview', icon: '📊', label: 'Platform Overview' },
            { id: 'tenants', icon: '🏫', label: `Schools & Tenants (${tenants.length})` },
            { id: 'revenue', icon: '💳', label: 'Revenue & Tier Matrix' },
            { id: 'admins', icon: '👑', label: `Super Admins (${admins.length})` },
            { id: 'diagnostics', icon: '🛠️', label: 'System Health' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Tier Distribution Cards */}
            <div>
              <h2 className="text-base font-bold text-white mb-3">Subscription Tier Distribution</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {PLAN_TIERS.map((tier) => {
                  const count = stats?.planDistribution?.[tier.name] || 0;
                  return (
                    <div key={tier.name} className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                      <div className="text-xs font-bold text-indigo-400">{tier.name}</div>
                      <div className="text-2xl font-extrabold text-white mt-1">{count}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {tier.price > 0 ? `GHS ${tier.price}/mo` : 'Free'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Registrations Table */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Recent School Onboardings</h3>
                  <p className="text-xs text-slate-400">Newly registered school tenants on the platform</p>
                </div>
                <button
                  onClick={() => setActiveTab('tenants')}
                  className="text-xs font-bold text-indigo-400 hover:underline"
                >
                  Manage All Schools →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 uppercase border-b border-slate-800 bg-slate-900/50">
                    <tr>
                      <th className="py-2.5 px-3">School Name</th>
                      <th className="py-2.5 px-3">Subdomain</th>
                      <th className="py-2.5 px-3">Plan</th>
                      <th className="py-2.5 px-3">Students</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {stats?.recentTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-bold text-white">{t.name}</td>
                        <td className="py-3 px-3 font-mono text-indigo-400">{t.subdomain}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                            {t.plan}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {t._count.students} / {t.studentLimit}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleImpersonate(t.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition flex items-center gap-1"
                          >
                            <span>⚡</span> Enter
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TENANTS MANAGEMENT */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Registered School Tenants</h2>
                <p className="text-xs text-slate-400">
                  Manage student quotas, upgrade plans, suspend accounts, and view school operations.
                </p>
              </div>
              <button
                onClick={fetchAllData}
                disabled={dataLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-2 self-start"
              >
                <span>🔄</span> Refresh List
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:w-96">
                <input
                  type="text"
                  placeholder="Search by school name, alias, subdomain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Plans</option>
                  {PLAN_TIERS.map((tier) => (
                    <option key={tier.name} value={tier.name}>
                      {tier.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
            </div>

            {/* Tenants Data Table */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 uppercase border-b border-slate-800 bg-slate-900/80">
                    <tr>
                      <th className="py-3 px-4">School</th>
                      <th className="py-3 px-4">Subdomain</th>
                      <th className="py-3 px-4">Plan Tier</th>
                      <th className="py-3 px-4">Student Capacity</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No schools match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((t) => {
                        const usageRatio = t.studentLimit > 0 ? (t._count.students / t.studentLimit) * 100 : 0;
                        return (
                          <tr key={t.id} className="hover:bg-slate-800/40">
                            <td className="py-3 px-4">
                              <div className="font-bold text-white text-sm">{t.name}</div>
                              {t.alias && <div className="text-[10px] text-slate-400">Alias: {t.alias}</div>}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/30">
                                {t.subdomain}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {t.plan}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200">
                                  {t._count.students} / {t.studentLimit}
                                </span>
                                <span className="text-[10px] text-slate-400">({Math.round(usageRatio)}%)</span>
                              </div>
                              <div className="w-28 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    usageRatio >= 90
                                      ? 'bg-red-500'
                                      : usageRatio >= 70
                                      ? 'bg-amber-500'
                                      : 'bg-indigo-500'
                                  }`}
                                  style={{ width: `${Math.min(usageRatio, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.status === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}
                              >
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {new Date(t.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleImpersonate(t.id)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1"
                                  title="Enter and manage this school dashboard as Owner"
                                >
                                  <span>⚡</span> Enter
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(t)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                                >
                                  ⚙️ Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REVENUE & TIER MATRIX */}
        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">SaaS Pricing & Revenue Matrix</h2>
              <p className="text-xs text-slate-400">
                Breakdown of subscription pricing tiers, student quotas, and monthly platform billing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLAN_TIERS.map((tier) => {
                const count = stats?.planDistribution?.[tier.name] || 0;
                const monthlyRev = tier.price * count;
                return (
                  <div key={tier.name} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{tier.name}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {count} Schools
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1">{tier.label}</h3>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white">GHS {tier.price}</span>
                        <span className="text-xs text-slate-400">/ month</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        Default Student Limit: <strong className="text-slate-200">{tier.defaultLimit} students</strong>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Monthly Yield:</span>
                      <span className="font-extrabold text-emerald-400">GHS {monthlyRev.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: SUPER ADMINS */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Platform Super Admins</h2>
                <p className="text-xs text-slate-400">
                  Accounts with full global access to the platform owner portal and all school databases.
                </p>
              </div>
              <button
                onClick={() => setShowAddAdminModal(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 self-start"
              >
                <span>➕</span> Add New Super Admin
              </button>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 uppercase border-b border-slate-800 bg-slate-900/80">
                  <tr>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Provisioned Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-bold text-white">{admin.fullName}</td>
                      <td className="py-3.5 px-4 font-mono text-indigo-400">{admin.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {admin.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                          {admin.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: SYSTEM DIAGNOSTICS */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">System Diagnostics & Infrastructure</h2>
              <p className="text-xs text-slate-400">
                Core infrastructure status, database connection, and payment gateway configuration checks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-white">PostgreSQL Neon Database</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 font-semibold">Connected (AWS US-East-2 Pooler)</span>
                </div>
                <div className="text-xs text-slate-400">
                  Direct connection active. Multi-tenant schema enforced with cascade deletions and cross-tenant isolation.
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-white">Authentication & JWT Security</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Active (HS256 64-char key)</span>
                </div>
                <div className="text-xs text-slate-400">
                  Role-based access control protecting all `/api/admin/*` and `/api/dashboard/*` endpoints.
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-white">Ghana Mobile Money (Paystack Gateway)</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Sandbox / Webhook Handler Ready</span>
                </div>
                <div className="text-xs text-slate-400">
                  Instant activation upon MTN MoMo / Telecel payment via `/api/subscriptions/webhook`.
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-white">CLI Super Admin Command</h3>
                <div className="text-xs text-slate-400">
                  Provision new super admin users directly from your terminal anytime:
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-xs text-indigo-400 border border-slate-800">
                  node scripts/create-superadmin.js [email] [password]
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EDIT TENANT MODAL */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Manage School Tenant</h3>
                <p className="text-xs text-slate-400">Subdomain: {editingTenant.subdomain}</p>
              </div>
              <button
                onClick={() => setEditingTenant(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">School Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Subscription Plan</label>
                  <select
                    value={editPlan}
                    onChange={(e) => {
                      setEditPlan(e.target.value);
                      const t = PLAN_TIERS.find((p) => p.name === e.target.value);
                      if (t) setEditLimit(t.defaultLimit);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none"
                  >
                    {PLAN_TIERS.map((tier) => (
                      <option key={tier.name} value={tier.name}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Student Capacity Limit</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editLimit}
                    onChange={(e) => setEditLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE (Normal School Access)</option>
                  <option value="SUSPENDED">SUSPENDED (Access Locked)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTenant}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {savingTenant ? 'Saving Changes...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SUPER ADMIN MODAL */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Add New Super Admin</h3>
                <p className="text-xs text-slate-400">Grant full master platform access to a user</p>
              </div>
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            {adminModalError && (
              <div className="p-3 mb-4 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs font-semibold">
                {adminModalError}
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="admin2@smsapp.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {creatingAdmin ? 'Creating...' : 'Provision Super Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
