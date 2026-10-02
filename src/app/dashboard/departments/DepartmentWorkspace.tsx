'use client';

/**
 * DepartmentWorkspace
 * -------------------
 * One screen that renders any Operations / Marketing page described in
 * `src/lib/departments.ts`: KPI strip, search + status filter, sortable table,
 * create/edit modal, delete confirmation, CSV export and empty/loading states.
 *
 * It is intentionally generic — the ten department pages differ only by their
 * config object, so a new page needs zero new UI code.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  departmentApiPath,
  statusOptions,
  statusTone,
  type DepartmentFieldDef,
  type DepartmentMetricDef,
  type DepartmentResourceDef,
} from '@/lib/departments';
import type { PermAction } from '@/lib/permissions';

type RecordRow = Record<string, unknown> & { id: string };

interface DepartmentWorkspaceProps {
  resource: DepartmentResourceDef;
  token: string | null;
  currency: string;
  can: (permKey: string, action?: PermAction) => boolean;
}

/* -------------------------------------------------------------------------- */
/* Static Tailwind class maps (never build class names dynamically)            */
/* -------------------------------------------------------------------------- */

const TONE_CARD: Record<DepartmentMetricDef['tone'], string> = {
  blue: 'from-blue-50 to-white border-blue-100',
  emerald: 'from-emerald-50 to-white border-emerald-100',
  amber: 'from-amber-50 to-white border-amber-100',
  rose: 'from-rose-50 to-white border-rose-100',
  violet: 'from-violet-50 to-white border-violet-100',
  slate: 'from-slate-50 to-white border-slate-200',
};

const TONE_VALUE: Record<DepartmentMetricDef['tone'], string> = {
  blue: 'text-blue-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  violet: 'text-violet-700',
  slate: 'text-slate-700',
};

const BADGE_TONE: Record<ReturnType<typeof statusTone>, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                          */
/* -------------------------------------------------------------------------- */

function formatMoney(value: unknown, currency: string): string {
  const num = Number(value ?? 0);
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateInput(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function emptyForm(resource: DepartmentResourceDef): Record<string, string> {
  const form: Record<string, string> = {};
  for (const field of resource.fields) {
    if (field.generated) continue;
    form[field.key] = field.defaultValue !== undefined ? String(field.defaultValue) : '';
  }
  return form;
}

function rowToForm(resource: DepartmentResourceDef, row: RecordRow): Record<string, string> {
  const form: Record<string, string> = {};
  for (const field of resource.fields) {
    if (field.generated) continue;
    const value = row[field.key];
    if (value === null || value === undefined) {
      form[field.key] = '';
    } else if (field.type === 'date') {
      form[field.key] = toDateInput(value);
    } else {
      form[field.key] = String(value);
    }
  }
  return form;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function DepartmentWorkspace({ resource, token, currency, can }: DepartmentWorkspaceProps) {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm(resource));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<RecordRow | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const apiPath = departmentApiPath(resource);
  const columns = useMemo(() => resource.fields.filter((f) => f.column), [resource]);
  const filterOptions = useMemo(() => statusOptions(resource), [resource]);
  const canCreate = can(resource.permKey, 'create');
  const canEdit = can(resource.permKey, 'edit');
  const canDelete = can(resource.permKey, 'delete');

  /* ----------------------------- data loading ----------------------------- */

  // The parent keys this component by resource, so a fresh mount (and a fresh
  // load) happens on every department page switch. `reloadKey` drives manual
  // refreshes without duplicating the fetch logic.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(apiPath, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || `Failed to load ${resource.title}`);
        setRecords((data.records || []) as RecordRow[]);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load records');
        setRecords([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [apiPath, resource.title, token, reloadKey]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  /* ------------------------------- filtering ------------------------------ */

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searchable = resource.fields.filter((f) => f.searchable);

    let rows = records.filter((row) => {
      if (statusFilter && resource.statusField && String(row[resource.statusField] ?? '') !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return searchable.some((f) => String(row[f.key] ?? '').toLowerCase().includes(q));
    });

    if (sortKey) {
      const field = resource.fields.find((f) => f.key === sortKey);
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        let cmp: number;
        if (field && (field.type === 'money' || field.type === 'number')) {
          cmp = Number(av) - Number(bv);
        } else if (field && field.type === 'date') {
          cmp = new Date(String(av)).getTime() - new Date(String(bv)).getTime();
        } else {
          cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [records, search, statusFilter, sortKey, sortDir, resource]);

  /* -------------------------------- metrics ------------------------------- */

  const metrics = useMemo(() => {
    const source = visible;
    return resource.metrics.map((metric) => {
      let display = '0';
      switch (metric.kind) {
        case 'count':
          display = source.length.toLocaleString();
          break;
        case 'countWhere': {
          const match = metric.match ?? [];
          display = source
            .filter((row) => match.includes(String(row[metric.field ?? ''] ?? '')))
            .length.toLocaleString();
          break;
        }
        case 'sum': {
          const total = source.reduce((acc, row) => acc + Number(row[metric.field ?? ''] ?? 0), 0);
          display = metric.money ? formatMoney(total, currency) : total.toLocaleString();
          break;
        }
        case 'sumProduct': {
          const [a, b] = metric.fields ?? ['', ''];
          const total = source.reduce((acc, row) => acc + Number(row[a] ?? 0) * Number(row[b] ?? 0), 0);
          display = metric.money ? formatMoney(total, currency) : total.toLocaleString();
          break;
        }
        case 'rate': {
          const match = metric.match ?? [];
          const hits = source.filter((row) => match.includes(String(row[metric.field ?? ''] ?? ''))).length;
          display = source.length === 0 ? '0%' : `${Math.round((hits / source.length) * 100)}%`;
          break;
        }
      }
      return { ...metric, display };
    });
  }, [visible, resource.metrics, currency]);

  /* --------------------------------- CRUD --------------------------------- */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(resource));
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: RecordRow) => {
    setEditing(row);
    setForm(rowToForm(resource, row));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const missing = resource.fields.find((f) => f.required && !f.generated && !String(form[f.key] ?? '').trim());
    if (missing) {
      setFormError(`${missing.label} is required.`);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of resource.fields) {
        if (field.generated) continue;
        payload[field.key] = form[field.key] ?? '';
      }

      const res = await fetch(editing ? `${apiPath}/${editing.id}` : apiPath, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      const saved = data.record as RecordRow;
      setRecords((prev) => (editing ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev]));
      setToast({ message: data.message || 'Saved', type: 'success' });
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !deleting) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`${apiPath}/${deleting.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setRecords((prev) => prev.filter((r) => r.id !== deleting.id));
      setToast({ message: data.message || `${resource.singular} deleted`, type: 'success' });
      setDeleting(null);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Delete failed', type: 'error' });
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleExport = () => {
    const headers = columns.map((c) => c.label);
    const lines = visible.map((row) =>
      columns
        .map((col) => {
          const raw = row[col.key];
          const value =
            col.type === 'date' ? formatDate(raw) : raw === null || raw === undefined ? '' : String(raw);
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csv = [headers.map((h) => `"${h}"`).join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  /* --------------------------------- cells -------------------------------- */

  const renderCell = (field: DepartmentFieldDef, row: RecordRow) => {
    const value = row[field.key];

    if (field.generated) {
      return <span className="font-mono font-bold text-blue-600">{String(value ?? '—')}</span>;
    }
    if (field.badge) {
      const label = String(value ?? '').trim();
      if (!label) return <span className="text-slate-400">—</span>;
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${BADGE_TONE[statusTone(label)]}`}>
          {label}
        </span>
      );
    }
    if (field.type === 'money') {
      return <span className="font-semibold text-slate-800 whitespace-nowrap">{formatMoney(value, currency)}</span>;
    }
    if (field.type === 'number') {
      return <span className="font-semibold text-slate-700">{Number(value ?? 0).toLocaleString()}</span>;
    }
    if (field.type === 'date') {
      return <span className="text-slate-600 whitespace-nowrap">{formatDate(value)}</span>;
    }
    if (field.type === 'email' && value) {
      return (
        <a href={`mailto:${String(value)}`} className="text-blue-600 hover:underline">
          {String(value)}
        </a>
      );
    }
    if (field.type === 'tel' && value) {
      return (
        <a href={`tel:${String(value)}`} className="text-slate-700 hover:text-blue-600">
          {String(value)}
        </a>
      );
    }

    const text = String(value ?? '').trim();
    if (!text) return <span className="text-slate-400">—</span>;
    return (
      <span className="text-slate-700 block max-w-[220px] truncate" title={text}>
        {text}
      </span>
    );
  };

  const formFields = resource.fields.filter((f) => !f.generated);

  /* --------------------------------- view --------------------------------- */

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl shrink-0">
            {resource.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{resource.title}</h1>
            <p className="text-sm text-slate-500 max-w-2xl">{resource.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={refresh}
            disabled={loading || refreshing}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50"
            title="Reload records"
          >
            {loading || refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <button
            onClick={handleExport}
            disabled={visible.length === 0}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-40"
            title="Export the filtered list to CSV"
          >
            ⬇ Export CSV
          </button>
          {canCreate && (
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5"
            >
              <span>➕</span> New {resource.singular}
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${TONE_CARD[metric.tone]}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{metric.label}</span>
              <span className="text-base">{metric.icon}</span>
            </div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${TONE_VALUE[metric.tone]}`}>
              {loading ? '—' : metric.display}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${resource.title.toLowerCase()}…`}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {filterOptions.length > 0 && resource.statusField && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            {filterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}

        <div className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
          Showing <span className="text-slate-800 font-bold">{visible.length}</span> of {records.length}
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={refresh} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 font-bold">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="py-3 px-4 font-bold cursor-pointer select-none hover:text-slate-900 whitespace-nowrap"
                    title={`Sort by ${col.label}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && <span className="text-blue-600">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </span>
                  </th>
                ))}
                <th className="py-3 px-4 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {columns.map((col) => (
                      <td key={col.key} className="py-3 px-4">
                        <div className="h-3 rounded bg-slate-100 animate-pulse" />
                      </td>
                    ))}
                    <td className="py-3 px-4">
                      <div className="h-3 rounded bg-slate-100 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="py-12 text-center">
                    <div className="text-3xl mb-2">{resource.icon}</div>
                    <p className="text-sm font-semibold text-slate-700">
                      {records.length === 0 ? `No ${resource.title.toLowerCase()} yet.` : 'No records match your filters.'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      {records.length === 0 ? resource.emptyHint : 'Try clearing the search box or the status filter.'}
                    </p>
                    {records.length === 0 && canCreate && (
                      <button
                        onClick={openCreate}
                        className="mt-3 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        + Add first {resource.singular.toLowerCase()}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition">
                    {columns.map((col) => (
                      <td key={col.key} className="py-3 px-4 align-middle">
                        {renderCell(col, row)}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {canEdit && (
                          <button
                            onClick={() => openEdit(row)}
                            className="px-2 py-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title={`Edit ${resource.singular.toLowerCase()}`}
                          >
                            ✏️
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleting(row)}
                            className="px-2 py-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                            title={`Delete ${resource.singular.toLowerCase()}`}
                          >
                            🗑️
                          </button>
                        )}
                        {!canEdit && !canDelete && <span className="text-slate-300">—</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{resource.icon}</span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editing ? `Edit ${resource.singular}` : `New ${resource.singular}`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editing && resource.codeField
                      ? `${String(editing[resource.codeField] ?? '')} · last updated ${formatDate(editing.updatedAt)}`
                      : resource.description}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                {formFields.map((field) => (
                  <div key={field.key} className={field.wide || field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        value={form[field.key] ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={form[field.key] ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      >
                        {!field.required && <option value="">— Select —</option>}
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={
                          field.type === 'number' || field.type === 'money'
                            ? 'number'
                            : field.type === 'date'
                            ? 'date'
                            : field.type === 'email'
                            ? 'email'
                            : field.type === 'tel'
                            ? 'tel'
                            : 'text'
                        }
                        step={field.type === 'money' ? '0.01' : undefined}
                        min={field.type === 'money' ? 0 : field.min}
                        max={field.max}
                        value={form[field.key] ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    )}

                    {field.hint && <p className="text-[10px] text-slate-400 mt-1">{field.hint}</p>}
                  </div>
                ))}
              </div>

              {formError && (
                <div className="mx-5 mb-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50 rounded-b-2xl">
                <p className="text-[10px] text-slate-400">
                  {resource.codeField && !editing
                    ? `A ${resource.codePrefix}- reference is generated automatically.`
                    : 'Changes are recorded in the audit log.'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition disabled:opacity-60 flex items-center gap-2"
                  >
                    {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {editing ? 'Save Changes' : `Create ${resource.singular}`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !deletingBusy && setDeleting(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-lg shrink-0">
                🗑️
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Delete {resource.singular.toLowerCase()}?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {resource.codeField && (
                    <span className="font-mono font-bold text-slate-700">{String(deleting[resource.codeField] ?? '')} · </span>
                  )}
                  This permanently removes the record from {resource.title}. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                disabled={deletingBusy}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingBusy}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-sm transition disabled:opacity-60 flex items-center gap-2"
              >
                {deletingBusy && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-xl shadow-lg text-xs font-bold text-white ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
