'use client';
import React, { useState } from "react";

export default function Home() {
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setMsg(`Success! School "${data.tenant.name}" created on subdomain "${data.tenant.subdomain}". Redirecting...`);
      localStorage.setItem("sms_token", data.token);
      localStorage.setItem("sms_tenant", JSON.stringify(data.tenant));
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setMsg(`Welcome back, ${data.user.fullName}! Redirecting...`);
      localStorage.setItem("sms_token", data.token);
      localStorage.setItem("sms_tenant", JSON.stringify(data.tenant));
      localStorage.setItem("sms_user", JSON.stringify(data.user));
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
            <a href="#pricing" className="hover:text-blue-600 transition">Pricing</a>
            <a href="#migration" className="hover:text-blue-600 transition">Sheets Migration</a>
          </nav>

          <div className="flex items-center gap-3">
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
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        <p>© 2026 SMS Global Cloud SaaS. Multi-tenant School Management System.</p>
      </footer>
    </div>
  );
}
