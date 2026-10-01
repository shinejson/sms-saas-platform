/**
 * Shared permission definitions for the role-based access control system.
 *
 * A permission record ("policy") is attached to one system role (e.g. BURSAR)
 * and stores, as a JSON map in the `Permission.actions` column, which sidebar
 * pages the role can see and which actions (create / edit / delete) it may
 * perform on each page.
 *
 * Shape of the JSON stored in `Permission.actions`:
 *   {
 *     "students":  ["view", "create", "edit", "delete"],
 *     "teachers":  ["view", "edit"],
 *     "invoices":  ["view"]
 *   }
 *
 * The dashboard renders its sidebar from these definitions, so the checkbox
 * groups in the Permissions modal always mirror the real sidebar 1:1.
 */

export type PermAction = 'view' | 'create' | 'edit' | 'delete';

export const PERM_ACTIONS: PermAction[] = ['view', 'create', 'edit', 'delete'];

export const PERM_ACTION_LABELS: Record<PermAction, string> = {
  view: 'Can see',
  create: 'Can add',
  edit: 'Can edit',
  delete: 'Can delete',
};

export type PermSectionKey = 'general' | 'people' | 'academics' | 'finance' | 'system';

export interface PermSectionDef {
  key: PermSectionKey;
  label: string;
  icon: string;
  description: string;
}

/** Sidebar sections — mirrors the group headers in the dashboard sidebar. */
export const PERM_SECTIONS: PermSectionDef[] = [
  { key: 'general', label: 'General', icon: '🏠', description: 'Dashboard overview' },
  { key: 'people', label: 'People', icon: '👥', description: 'Student, staff & guardian records' },
  { key: 'academics', label: 'Academics', icon: '🏫', description: 'Classes, subjects, attendance & assessments' },
  { key: 'finance', label: 'Finance', icon: '💰', description: 'Fees, invoices & payments' },
  { key: 'system', label: 'System', icon: '⚙️', description: 'Configuration, reports & administration' },
];

export interface PermPageDef {
  /** Stable key stored inside the actions JSON map. */
  key: string;
  /** Sidebar label of the page. */
  label: string;
  icon: string;
  section: PermSectionKey;
  /** Dashboard `activeTab` value this page maps to. */
  tab: string;
  /** Optional sub-tab (e.g. billing -> items | categories). */
  subTab?: string;
  /** Actions available on this page. `view` is always implied first. */
  actions: PermAction[];
  /** Optional note shown in the permission builder. */
  hint?: string;
}

/** Every page that appears in the dashboard sidebar, in sidebar order. */
export const PERM_PAGES: PermPageDef[] = [
  // General
  { key: 'overview', label: 'Dashboard', icon: '📊', section: 'general', tab: 'overview', actions: ['view'] },

  // People
  { key: 'students', label: 'Students', icon: '🎓', section: 'people', tab: 'students', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'teachers', label: 'Teachers', icon: '👨‍🏫', section: 'people', tab: 'teachers', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'users', label: 'Users', icon: '🧑‍💻', section: 'people', tab: 'users', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'parents', label: 'Parents', icon: '👨‍👩‍👧', section: 'people', tab: 'parents', actions: ['view', 'create', 'edit', 'delete'] },
  {
    key: 'permissions',
    label: 'Permissions',
    icon: '🛡️',
    section: 'people',
    tab: 'permissions',
    actions: ['view', 'create', 'edit', 'delete'],
    hint: 'School & Super Admins always keep access to this page so a school can never lock itself out.',
  },

  // Academics
  { key: 'classes', label: 'Classes', icon: '🏫', section: 'academics', tab: 'classes', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'subjects', label: 'Subjects', icon: '📚', section: 'academics', tab: 'subjects', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'enrollments', label: 'Enrollments', icon: '📝', section: 'academics', tab: 'enrollments', actions: ['view', 'create'] },
  { key: 'attendance', label: 'Attendance', icon: '📅', section: 'academics', tab: 'attendance', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'academic_years', label: 'Academic Years', icon: '🗓️', section: 'academics', tab: 'academic-years', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'performance', label: 'Assessment', icon: '🧮', section: 'academics', tab: 'performance', actions: ['view', 'create', 'edit', 'delete'] },

  // Finance
  { key: 'invoices', label: 'Invoices', icon: '🧾', section: 'finance', tab: 'invoices', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'payments', label: 'Payments', icon: '💰', section: 'finance', tab: 'payments', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'billing_items', label: 'Billings', icon: '🏷️', section: 'finance', tab: 'billing', subTab: 'items', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'billing_categories', label: 'Billing Categories', icon: '📁', section: 'finance', tab: 'billing', subTab: 'categories', actions: ['view', 'create', 'edit', 'delete'] },

  // System
  { key: 'subscription', label: 'Subscription', icon: '💳', section: 'system', tab: 'subscription', actions: ['view'] },
  { key: 'settings', label: 'Settings', icon: '⚙️', section: 'system', tab: 'settings', actions: ['view', 'edit'] },
  { key: 'reports', label: 'Reports', icon: '📈', section: 'system', tab: 'reports', actions: ['view'] },
  { key: 'migration', label: 'Sheets Migration', icon: '🔄', section: 'system', tab: 'migration', actions: ['view', 'create'] },
];

export interface PermRoleDef {
  /** Matches the `role` enum on the User model. */
  value: string;
  label: string;
  description: string;
}

/** System roles a permission policy can be attached to. */
export const PERM_ROLES: PermRoleDef[] = [
  { value: 'SCHOOL_ADMIN', label: 'School Admin', description: 'Full administrative control of the school workspace' },
  { value: 'BURSAR', label: 'Bursar (Accountant)', description: 'Fees, invoices, payments & financial records' },
  { value: 'TEACHER', label: 'Teacher', description: 'Classes, subjects, attendance & assessments' },
  { value: 'VIEWER', label: 'Viewer', description: 'Read-only access to school records' },
  { value: 'PARENT', label: 'Parent', description: 'Guardian access to child records & fee status' },
];

/** Pretty display label for a role value (falls back to the raw string). */
export function permRoleLabel(value: string): string {
  const found = PERM_ROLES.find((r) => r.value === value?.toUpperCase());
  return found ? found.label : value;
}

/** Page lookup helper. */
export function permPageByKey(key: string): PermPageDef | undefined {
  return PERM_PAGES.find((p) => p.key === key);
}

/** Roles that bypass permission policies for platform administration. */
export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

/** School-level administrators (and the platform super admin). */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';
}

/** Parsed policy: pageKey -> allowed actions. */
export type PermPolicy = Record<string, PermAction[]>;

/**
 * Parse the JSON stored in `Permission.actions` into a sanitized policy.
 * Returns null when the value is missing or not a valid policy map
 * (e.g. legacy free-text records) — callers treat null as "no policy".
 */
export function parsePermPolicy(raw: string | null | undefined): PermPolicy | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const policy: PermPolicy = {};
    for (const [pageKey, actions] of Object.entries(parsed)) {
      const page = permPageByKey(pageKey);
      if (!page || !Array.isArray(actions)) continue;
      const clean = actions.filter((a): a is PermAction => PERM_ACTIONS.includes(a as PermAction));
      if (clean.length > 0) policy[pageKey] = clean;
    }
    return policy;
  } catch {
    return null;
  }
}

/**
 * Validate & normalize an incoming `actions` value for POST/PUT.
 * Returns a safe JSON string to persist, or an error message.
 */
export function validatePermActionsInput(
  raw: unknown
): { ok: true; actions: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'Permitted actions are required. Check at least one page this role can access.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Permitted actions must be a valid permission map (JSON).' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Permitted actions must be a valid permission map (JSON).' };
  }
  const policy = parsePermPolicy(raw);
  if (!policy || Object.keys(policy).length === 0) {
    return { ok: false, error: 'Select at least one page (with "Can see") for this role.' };
  }
  return { ok: true, actions: JSON.stringify(policy) };
}
