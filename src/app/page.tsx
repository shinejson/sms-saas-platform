'use client';
import React, { useState, useEffect } from "react";

export default function Home() {
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("sms_token")) {
      setHasActiveSession(true);
    }
  }, []);

  const [formData, setFormData] = useState({
    schoolName: "",
    schoolAlias: "",
    subdomain: "",
    adminFullName: "",
    adminEmail: "",
    adminPassword: "",
    currency: "GHS",
  });

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    subdomain: "",
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/auth/register-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned unexpected response (${res.status}): Please check backend server.`);
      }
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setMsg(`Success! School "${data.tenant.name}" created on subdomain "${data.tenant.subdomain}". Redirecting to dashboard...`);
      localStorage.setItem("sms_token", data.token);
      localStorage.setItem("sms_tenant", JSON.stringify(data.tenant));
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 700);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned unexpected response (${res.status}): Please check backend server.`);
      }
      if (!res.ok) throw new Error(data.error || "Login failed");
      setMsg(`Welcome back, ${data.user.fullName}! Redirecting to dashboard...`);
      localStorage.setItem("sms_token", data.token);
      localStorage.setItem("sms_tenant", JSON.stringify(data.tenant));
      localStorage.setItem("sms_user", JSON.stringify(data.user));
      setTimeout(() => {
        window.location.href = data.user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard';
      }, 700);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏫</span>
            <span className="font-bold text-xl tracking-tight text-blue-600">SMS Global Cloud</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">SaaS Platform</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition">Features</a>
            <a href="#analytics" className="hover:text-blue-600 transition font-semibold text-blue-600">Live Dashboard & Charts</a>
            <a href="#pricing" className="hover:text-blue-600 transition">Pricing</a>
            <a href="#migration" className="hover:text-blue-600 transition">Sheets Migration</a>
          </nav>

          <div className="flex items-center gap-3">
            {hasActiveSession && (
              <a
                href="/dashboard"
                className="px-4 py-2 text-sm font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition flex items-center gap-1.5"
              >
                <span>🚀</span> Go to Dashboard
              </a>
            )}
            <button
              onClick={() => { setShowLogin(true); setShowRegister(false); setError(""); setMsg(""); }}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-blue-600"
            >
              Sign In
            </button>
            <button
              onClick={() => { setShowRegister(true); setShowLogin(false); setError(""); setMsg(""); }}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition"
            >
              Register School
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-28 bg-gradient-to-b from-blue-50/50 via-white to-slate-50">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-6">
              <span>✨</span> Multi-Tenant School Management Platform
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
              One Cloud Platform to Run Your <span className="text-blue-600">Entire School</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
              Student enrollment, attendance registers, subject schedules, academic year billing, and Mobile Money fee collection. Built for schools of all sizes.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => { setShowRegister(true); setShowLogin(false); }}
                className="px-8 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:shadow-xl transition"
              >
                Start Free School Trial (15 Students)
              </button>
              <a
                href="#pricing"
                className="px-8 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-base hover:bg-slate-50 transition"
              >
                View Plans & Pricing
              </a>
            </div>

            {/* Feature highlights bar */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
              {[
                { icon: "🎓", title: "Student Directory", desc: "Full bio, photos & guardian records" },
                { icon: "📅", title: "Attendance Registers", desc: "Automated daily & term roll call" },
                { icon: "💳", title: "MoMo & Bank Billing", desc: "MTN, Telecel & Cards in GHS" },
                { icon: "📊", title: "Academic Insights", desc: "Per-year billing & recovery rates" },
              ].map((f, i) => (
                <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h3 className="font-semibold text-sm text-slate-900">{f.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Dashboard Analytics & Charts Showcase */}
        <section id="analytics" className="py-20 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-semibold mb-4">
                <span>📊</span> Real-Time Analytics & Reporting
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
                Full Financial & Operational Clarity in One Place
              </h2>
              <p className="text-slate-400 text-base sm:text-lg">
                Stop guessing fee recoveries and daily attendance. Interactive visual charts provide immediate actionable insight for every classroom and academic year.
              </p>
            </div>

            {/* Dashboard Mockup Container */}
            <div className="rounded-3xl bg-slate-950/80 border border-slate-800 p-4 sm:p-8 shadow-2xl backdrop-blur-xl">
              {/* Mockup Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                    📊
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Executive Operations & Analytics</h3>
                    <p className="text-xs text-slate-400">Filters applied automatically across academic years & terms</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold">
                    Mukaila 2026/2027 (Active)
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                    All Terms
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                    ● Live Sync
                  </span>
                </div>
              </div>

              {/* 4 KPI Cards Mockup */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL STUDENTS</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">2</div>
                  <div className="text-[11px] text-emerald-400 font-semibold mt-2">+2 enrolled across classes</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ACTIVE SUBJECTS</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">8</div>
                  <div className="text-[11px] text-blue-400 font-semibold mt-2">8 active taught this term</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AVERAGE ATTENDANCE</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">94.8%</div>
                  <div className="text-[11px] text-purple-400 font-semibold mt-2">High attendance rate</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL INVOICES</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">1</div>
                  <div className="text-[11px] text-amber-400 font-semibold mt-2">1 unpaid generated</div>
                </div>
              </div>

              {/* 3 Visual SVG Charts Mockup */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Chart 1: Payment Status by Class */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-bold text-white">Payment Status by Class</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Paid</span>
                      <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" /> Unpaid</span>
                    </div>
                  </div>
                  <svg viewBox="0 0 320 160" className="w-full h-36">
                    <line x1="30" y1="20" x2="300" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="30" y1="55" x2="300" y2="55" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="30" y1="90" x2="300" y2="90" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="30" y1="125" x2="300" y2="125" stroke="#334155" />
                    {/* Class 1 (Unpaid = 1) */}
                    <rect x="65" y="45" width="14" height="80" rx="3" fill="#ef4444" />
                    <text x="72" y="38" textAnchor="middle" fontSize="9" fill="#ef4444" fontWeight="bold">1</text>
                    <text x="72" y="142" textAnchor="middle" fontSize="10" fill="#94a3b8">Class 1</text>
                    {/* Class 3 */}
                    <text x="165" y="142" textAnchor="middle" fontSize="10" fill="#94a3b8">Class 3</text>
                    {/* Unassigned */}
                    <text x="250" y="142" textAnchor="middle" fontSize="10" fill="#94a3b8">Unassigned</text>
                    <text x="22" y="128" textAnchor="end" fontSize="9" fill="#64748b">0.0</text>
                    <text x="22" y="58" textAnchor="end" fontSize="9" fill="#64748b">0.8</text>
                    <text x="22" y="24" textAnchor="end" fontSize="9" fill="#64748b">1.0</text>
                  </svg>
                </div>

                {/* Chart 2: Attendance Trend */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-bold text-white">Attendance Trend</span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">Term 1 · 2026/2027</span>
                  </div>
                  <svg viewBox="0 0 320 160" className="w-full h-36">
                    <defs>
                      <linearGradient id="landingAttendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line x1="30" y1="20" x2="300" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="30" y1="72" x2="300" y2="72" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="30" y1="125" x2="300" y2="125" stroke="#334155" />
                    <path d="M 45 60 L 95 45 L 145 52 L 195 35 L 245 40 L 290 28 L 290 125 L 45 125 Z" fill="url(#landingAttendGrad)" />
                    <path d="M 45 60 L 95 45 L 145 52 L 195 35 L 245 40 L 290 28" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                    {[[45, 60, "Sep 20"], [95, 45, "Sep 21"], [145, 52, "Sep 22"], [195, 35, "Sep 23"], [245, 40, "Sep 24"], [290, 28, "Sep 25"]].map(([x, y, label], i) => (
                      <g key={i}>
                        <circle cx={x as number} cy={y as number} r="3" fill="#ffffff" stroke="#3b82f6" strokeWidth="2" />
                        <text x={x as number} y="142" textAnchor="middle" fontSize="9" fill="#94a3b8">{label as string}</text>
                      </g>
                    ))}
                    <text x="22" y="128" textAnchor="end" fontSize="9" fill="#64748b">0%</text>
                    <text x="22" y="75" textAnchor="end" fontSize="9" fill="#64748b">50%</text>
                    <text x="22" y="24" textAnchor="end" fontSize="9" fill="#64748b">100%</text>
                  </svg>
                </div>

                {/* Chart 3: Students by Class */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-bold text-white">Students by Class</span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">all years</span>
                  </div>
                  <svg viewBox="0 0 320 160" className="w-full h-36">
                    <line x1="30" y1="20" x2="300" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="30" y1="55" x2="300" y2="55" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="30" y1="90" x2="300" y2="90" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="30" y1="125" x2="300" y2="125" stroke="#334155" />
                    {/* Class 1 (1 student) */}
                    <rect x="58" y="45" width="22" height="80" rx="3" fill="#3b82f6" />
                    <text x="69" y="38" textAnchor="middle" fontSize="9" fill="#60a5fa" fontWeight="bold">1</text>
                    <text x="69" y="142" textAnchor="middle" fontSize="10" fill="#94a3b8">Class 1</text>
                    {/* Class 3 (1 student) */}
                    <rect x="155" y="45" width="22" height="80" rx="3" fill="#3b82f6" />
                    <text x="166" y="38" textAnchor="middle" fontSize="9" fill="#60a5fa" fontWeight="bold">1</text>
                    <text x="166" y="142" textAnchor="middle" fontSize="10" fill="#94a3b8">Class 3</text>
                    {/* Unassigned */}
                    <text x="255" y="142" textAnchor="middle" fontSize="10" fill="#94a3b8">Unassigned</text>
                    <text x="22" y="128" textAnchor="end" fontSize="9" fill="#64748b">0.0</text>
                    <text x="22" y="58" textAnchor="end" fontSize="9" fill="#64748b">0.8</text>
                    <text x="22" y="24" textAnchor="end" fontSize="9" fill="#64748b">1.0</text>
                  </svg>
                </div>
              </div>

              {/* Quick Insights Banner */}
              <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-900/40 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">INVOICES</div>
                  <div className="text-xl font-bold text-white mt-0.5">1 Generated</div>
                  <div className="text-[10px] text-red-400 mt-0.5 font-medium">0 paid · 1 unpaid</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">TOTAL BILLED</div>
                  <div className="text-xl font-bold text-white mt-0.5">GHS 0.00</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">0 payments recorded</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">COLLECTED</div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">GHS 0.00</div>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    0.0% collected
                  </span>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">OUTSTANDING</div>
                  <div className="text-xl font-bold text-red-400 mt-0.5">GHS 0.00</div>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300">
                    100.0% outstanding
                  </span>
                </div>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl mb-4">
                  💳
                </div>
                <h4 className="font-bold text-base text-white mb-2">Class-by-Class Fee Tracking</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Identify unpaid student balances instantly categorized by classroom. Streamline payment reminders and eliminate manual ledger reconciliations.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl mb-4">
                  📈
                </div>
                <h4 className="font-bold text-base text-white mb-2">Attendance Trend Analytics</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Spot absenteeism spikes and student retention fluctuations across terms and dates with visual trend lines and automated presence percentages.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xl mb-4">
                  🏫
                </div>
                <h4 className="font-bold text-base text-white mb-2">Capacity & Quota Management</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Keep classroom populations balanced with student distribution metrics. Enforce license quotas smoothly with visual progress meters and upgrade tiers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Table */}
        <section id="pricing" className="py-20 bg-white border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Transparent Pricing for Every School Size</h2>
            <p className="text-slate-600 max-w-2xl mx-auto mb-14">
              Choose the tier that fits your student population. Pay monthly or yearly via Mobile Money or Card.
            </p>

            <div className="grid md:grid-cols-4 gap-8 text-left">
              {[
                { name: "Free Demo", price: "GHS 0", limit: "15 Students", desc: "Full feature test drive for new schools", cta: "Try for Free", popular: false },
                { name: "Copper Plan", price: "GHS 150", limit: "100 Students", desc: "Ideal for small prep & primary schools", cta: "Get Started", popular: false },
                { name: "Silver Plan", price: "GHS 300", limit: "250 Students", desc: "For growing basic schools and academies", cta: "Choose Silver", popular: true },
                { name: "Gold Plan", price: "GHS 600", limit: "600 Students", desc: "Comprehensive package for large schools", cta: "Choose Gold", popular: false },
              ].map((tier, idx) => (
                <div
                  key={idx}
                  className={`p-6 rounded-2xl flex flex-col justify-between border ${
                    tier.popular ? "border-blue-500 ring-2 ring-blue-500 bg-blue-50/20" : "border-slate-200 bg-white"
                  }`}
                >
                  <div>
                    {tier.popular && (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-600 text-white mb-3">
                        Most Popular
                      </span>
                    )}
                    <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-4">{tier.desc}</p>
                    <div className="text-3xl font-extrabold text-slate-900 mb-1">{tier.price}</div>
                    <div className="text-xs font-semibold text-blue-600 mb-6">Up to {tier.limit}</div>

                    <ul className="text-xs space-y-2 text-slate-600 mb-6">
                      <li>✓ Unlimited Staff & Teachers</li>
                      <li>✓ Student Directory & Bio-data</li>
                      <li>✓ Attendance Roll & Reporting</li>
                      <li>✓ Invoicing & Payment Tracking</li>
                      <li>✓ Dedicated Subdomain</li>
                    </ul>
                  </div>

                  <button
                    onClick={() => { setShowRegister(true); setShowLogin(false); }}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition ${
                      tier.popular
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                    }`}
                  >
                    {tier.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Google Sheets Migration Feature */}
        <section id="migration" className="py-20 bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <span className="text-3xl mb-3 inline-block">🔄</span>
            <h2 className="text-3xl font-bold mb-4">Already using Google Sheets? Migrate in 1-Click</h2>
            <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
              Our automated migration utility takes your existing Google Sheets SMS export and populates your students, courses, classes, and invoices instantly.
            </p>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs text-emerald-400">
              <span>POST /api/migrate</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300">Automated Data Importer Ready</span>
            </div>
          </div>
        </section>
      </main>

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowRegister(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold"
            >
              ×
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Register New School</h2>
            <p className="text-xs text-slate-500 mb-6">Create your isolated school tenant and start free trial.</p>

            {error && <div className="p-3 mb-4 rounded-lg bg-red-50 text-red-700 text-xs font-medium">{error}</div>}
            {msg && <div className="p-3 mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">{msg}</div>}

            <form onSubmit={handleRegister} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">School Full Name</label>
                <input
                  required
                  placeholder="e.g. Global Evangelical Basic School"
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">School Alias</label>
                  <input
                    placeholder="e.g. GEBS"
                    value={formData.schoolAlias}
                    onChange={(e) => setFormData({ ...formData, schoolAlias: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subdomain</label>
                  <input
                    required
                    placeholder="e.g. global-school"
                    value={formData.subdomain}
                    onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Full Name</label>
                <input
                  required
                  placeholder="e.g. Headmaster / Proprietor Name"
                  value={formData.adminFullName}
                  onChange={(e) => setFormData({ ...formData, adminFullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  placeholder="admin@school.com"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? "Provisioning School..." : "Provision School Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold"
            >
              ×
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Sign In to School</h2>
            <p className="text-xs text-slate-500 mb-6">Enter your school credentials to access the portal.</p>

            {error && <div className="p-3 mb-4 rounded-lg bg-red-50 text-red-700 text-xs font-medium">{error}</div>}
            {msg && <div className="p-3 mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">{msg}</div>}

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">School Subdomain (optional)</label>
                <input
                  placeholder="e.g. global-school"
                  value={loginData.subdomain}
                  onChange={(e) => setLoginData({ ...loginData, subdomain: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="user@school.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100 mt-2">
                Are you the Platform Owner?{" "}
                <a href="/admin" className="font-bold text-indigo-600 hover:underline">
                  Super Admin Portal →
                </a>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-8 text-center text-xs text-slate-500 space-y-2">
        <p>© 2026 SMS Global Cloud SaaS. Multi-tenant School Management System.</p>
        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-600">
          <a href="/admin" className="text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1.5">
            <span>👑</span> Platform Owner & Super Admin Portal
          </a>
        </div>
      </footer>
    </div>
  );
}
