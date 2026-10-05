/**
 * Session policy + browser-side session store.
 * ---------------------------------------------------------------------------
 * The platform authenticates with a JWT that the browser keeps in
 * localStorage. Before this module existed the dashboard only checked that a
 * token *string* was present, so a token left in localStorage months earlier
 * still opened `/dashboard` straight away (every API call then silently 401'd).
 *
 * The rules implemented here:
 *   1. ABSOLUTE LIFETIME  - a session may never live longer than
 *      SESSION_ABSOLUTE_MS (default 12h) measured from the moment the user
 *      actually signed in (`sst` claim).
 *   2. IDLE / LAST ACTIVITY - a session dies after SESSION_IDLE_MS (default
 *      30 min) without user activity. The access token is minted with exactly
 *      that lifetime and is slid forward (rotated) while the user is active,
 *      so the *server* enforces the idle window too - not just the UI.
 *   3. Every protected page validates the token (signature + expiry + account
 *      status) against the server on mount before rendering anything.
 *
 * This file is isomorphic: the constants/claim helpers run on the server too,
 * the storage helpers no-op outside the browser.
 */

/* -------------------------------------------------------------------------- */
/* Policy configuration                                                        */
/* -------------------------------------------------------------------------- */

function readNumberEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Minutes of inactivity after which the user is signed out. */
export const SESSION_IDLE_MINUTES = readNumberEnv(
  process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES,
  30,
  1,
  24 * 60
);

/** Hard cap on a session regardless of activity. */
export const SESSION_ABSOLUTE_HOURS = readNumberEnv(
  process.env.NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS,
  12,
  1,
  24 * 30
);

/** How long the "you are about to be signed out" dialog is shown. */
export const SESSION_WARNING_SECONDS = readNumberEnv(
  process.env.NEXT_PUBLIC_SESSION_WARNING_SECONDS,
  60,
  10,
  10 * 60
);

export const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60_000;
export const SESSION_ABSOLUTE_MS = SESSION_ABSOLUTE_HOURS * 60 * 60_000;
/** Never warn for longer than half of the idle window. */
export const SESSION_WARNING_MS = Math.min(SESSION_WARNING_SECONDS * 1000, SESSION_IDLE_MS / 2);

/** Access-token lifetime handed to `jwt.sign` (seconds). */
export const SESSION_TOKEN_TTL_SECONDS = Math.floor(SESSION_IDLE_MS / 1000);

/** Activity is only written to localStorage this often (keeps writes cheap). */
export const ACTIVITY_PERSIST_INTERVAL_MS = 15_000;

/** Rotate the token once less than this share of its lifetime is left. */
export const TOKEN_REFRESH_THRESHOLD_RATIO = 0.5;

/** Clock-skew tolerance when comparing expiry timestamps. */
export const CLOCK_SKEW_MS = 5_000;

/* -------------------------------------------------------------------------- */
/* Storage keys                                                                */
/* -------------------------------------------------------------------------- */

export const SESSION_KEYS = {
  token: 'sms_token',
  user: 'sms_user',
  tenant: 'sms_tenant',
  lastActivity: 'sms_last_activity',
  logoutReason: 'sms_logout_reason',
} as const;

/* -------------------------------------------------------------------------- */
/* Logout reasons                                                              */
/* -------------------------------------------------------------------------- */

export type LogoutReason =
  | 'inactivity'
  | 'expired'
  | 'invalid'
  | 'suspended'
  | 'forbidden'
  | 'manual'
  | 'other-tab';

export const LOGOUT_MESSAGES: Record<LogoutReason, string> = {
  inactivity: `You were signed out after ${SESSION_IDLE_MINUTES} minutes of inactivity. Please sign in again.`,
  expired: 'Your session has expired. Please sign in again.',
  invalid: 'Your session is no longer valid. Please sign in again.',
  suspended: 'This account is suspended or deactivated. Contact your administrator.',
  forbidden: 'You do not have access to that area. Please sign in with an authorised account.',
  manual: 'You have been signed out.',
  'other-tab': 'You were signed out in another tab.',
};

export function isLogoutReason(value: string | null | undefined): value is LogoutReason {
  return !!value && Object.prototype.hasOwnProperty.call(LOGOUT_MESSAGES, value);
}

export function logoutMessage(reason: string | null | undefined): string | null {
  return isLogoutReason(reason) ? LOGOUT_MESSAGES[reason] : null;
}

/* -------------------------------------------------------------------------- */
/* JWT claim helpers (decode only - never trust these for authorisation)       */
/* -------------------------------------------------------------------------- */

export interface TokenClaims {
  userId?: string;
  tenantId?: string;
  email?: string;
  fullName?: string;
  role?: string;
  subdomain?: string;
  jti?: string;
  /** Issued at (seconds). */
  iat?: number;
  /** Expires at (seconds) - the idle deadline enforced by the server. */
  exp?: number;
  /** Session start time (seconds) - survives token rotation. */
  sst?: number;
}

function base64UrlDecode(segment: string): string | null {
  try {
    const normalised = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
    if (typeof atob === 'function') {
      // Browser / edge runtime
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Decodes the JWT payload WITHOUT verifying the signature. Used by the browser
 * purely to know when to refresh/expire the UI - the server always re-verifies.
 */
export function decodeTokenClaims(token: string | null | undefined): TokenClaims | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const json = base64UrlDecode(parts[1]);
  if (!json) return null;
  try {
    const claims = JSON.parse(json);
    return claims && typeof claims === 'object' ? (claims as TokenClaims) : null;
  } catch {
    return null;
  }
}

/** Token expiry in ms (the server-side idle deadline), or null. */
export function tokenExpiresAt(token: string | null | undefined): number | null {
  const exp = decodeTokenClaims(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

/** Moment the user actually signed in (ms) - survives token rotation. */
export function sessionStartedAt(token: string | null | undefined): number | null {
  const claims = decodeTokenClaims(token);
  const start = claims?.sst ?? claims?.iat;
  return typeof start === 'number' ? start * 1000 : null;
}

/** Absolute deadline (ms) for this session, independent of activity. */
export function sessionAbsoluteDeadline(token: string | null | undefined): number | null {
  const start = sessionStartedAt(token);
  return start === null ? null : start + SESSION_ABSOLUTE_MS;
}

/** The idle window the token was minted with (falls back to the local policy). */
export function tokenIdleWindowMs(token: string | null | undefined): number {
  const claims = decodeTokenClaims(token);
  if (claims && typeof claims.exp === 'number' && typeof claims.iat === 'number') {
    const window = (claims.exp - claims.iat) * 1000;
    if (window > 0) return window;
  }
  return SESSION_IDLE_MS;
}

export function isTokenExpired(token: string | null | undefined, now = Date.now()): boolean {
  const expiresAt = tokenExpiresAt(token);
  if (expiresAt === null) return true; // tokens without `exp` are not trusted
  return now >= expiresAt - CLOCK_SKEW_MS;
}

/* -------------------------------------------------------------------------- */
/* Stored session shapes                                                       */
/* -------------------------------------------------------------------------- */

export interface StoredUser {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export interface StoredTenant {
  id?: string;
  name?: string;
  alias?: string;
  subdomain?: string;
  [key: string]: unknown;
}

const isBrowser = () => typeof window !== 'undefined';

function safeGet(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage disabled / quota - session simply falls back to in-memory */
  }
}

function safeRemove(key: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readJson<T>(key: string): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readToken(): string | null {
  return safeGet(SESSION_KEYS.token);
}

export function readUser(): StoredUser | null {
  return readJson<StoredUser>(SESSION_KEYS.user);
}

export function readTenant(): StoredTenant | null {
  return readJson<StoredTenant>(SESSION_KEYS.tenant);
}

export function readLastActivity(): number | null {
  const raw = safeGet(SESSION_KEYS.lastActivity);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Records "the user did something" - the heartbeat of the idle timeout. */
export function writeLastActivity(timestamp: number = Date.now()) {
  safeSet(SESSION_KEYS.lastActivity, String(timestamp));
}

export function writeToken(token: string) {
  safeSet(SESSION_KEYS.token, token);
}

export function writeUser(user: unknown) {
  if (user === null || user === undefined) return;
  safeSet(SESSION_KEYS.user, JSON.stringify(user));
}

export function writeTenant(tenant: unknown) {
  if (tenant === null || tenant === undefined) return;
  safeSet(SESSION_KEYS.tenant, JSON.stringify(tenant));
}

/** Persists a freshly issued session (called straight after a login). */
export function storeSession(params: { token: string; user?: unknown; tenant?: unknown }) {
  writeToken(params.token);
  writeUser(params.user);
  writeTenant(params.tenant);
  writeLastActivity();
  clearLogoutReason();
}

/** Wipes every session artefact and remembers why, for the login screen. */
export function clearSession(reason?: LogoutReason) {
  safeRemove(SESSION_KEYS.token);
  safeRemove(SESSION_KEYS.user);
  safeRemove(SESSION_KEYS.tenant);
  safeRemove(SESSION_KEYS.lastActivity);
  if (reason && isBrowser()) {
    try {
      window.sessionStorage.setItem(SESSION_KEYS.logoutReason, reason);
    } catch {
      /* ignore */
    }
  }
}

export function clearLogoutReason() {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(SESSION_KEYS.logoutReason);
  } catch {
    /* ignore */
  }
}

/** Reads (and clears) the reason of the last sign-out, for a one-shot banner. */
export function consumeLogoutReason(): LogoutReason | null {
  if (!isBrowser()) return null;
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEYS.logoutReason);
    if (stored) window.sessionStorage.removeItem(SESSION_KEYS.logoutReason);
    return isLogoutReason(stored) ? stored : null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Local (pre-flight) evaluation of the stored session                         */
/* -------------------------------------------------------------------------- */

export type SessionEvaluation =
  | { state: 'none' }
  | { state: 'invalid'; reason: LogoutReason }
  | {
      state: 'valid';
      token: string;
      user: StoredUser | null;
      tenant: StoredTenant | null;
      claims: TokenClaims;
      /** Server-enforced token expiry (ms). */
      tokenExpiresAt: number;
      /** lastActivity + idle window (ms). */
      idleDeadline: number;
      /** Hard session cap (ms). */
      absoluteDeadline: number;
      lastActivityAt: number;
    };

/**
 * Cheap local check performed before any network call: is there a token, is it
 * structurally sound, is it still inside its expiry, and has the user been
 * active inside the idle window?
 */
export function evaluateStoredSession(now: number = Date.now()): SessionEvaluation {
  const token = readToken();
  if (!token) return { state: 'none' };

  const claims = decodeTokenClaims(token);
  if (!claims || !claims.userId || typeof claims.exp !== 'number') {
    return { state: 'invalid', reason: 'invalid' };
  }

  const expiresAt = claims.exp * 1000;
  const absoluteDeadline = sessionAbsoluteDeadline(token) ?? expiresAt;
  const idleWindow = tokenIdleWindowMs(token);
  // No activity stamp yet (session created before this feature, or storage was
  // cleared): fall back to when the token was issued.
  const lastActivityAt = readLastActivity() ?? (typeof claims.iat === 'number' ? claims.iat * 1000 : 0);
  const idleDeadline = lastActivityAt + idleWindow;

  if (now >= expiresAt - CLOCK_SKEW_MS) {
    // The token itself is dead. If the user had simply stopped interacting we
    // report it as an idle timeout, which is the more accurate explanation.
    return { state: 'invalid', reason: idleDeadline <= expiresAt ? 'inactivity' : 'expired' };
  }
  if (now >= idleDeadline) return { state: 'invalid', reason: 'inactivity' };
  if (now >= absoluteDeadline) return { state: 'invalid', reason: 'expired' };

  return {
    state: 'valid',
    token,
    user: readUser(),
    tenant: readTenant(),
    claims,
    tokenExpiresAt: expiresAt,
    idleDeadline,
    absoluteDeadline,
    lastActivityAt,
  };
}

/** True when a usable, non-expired, non-idle session exists in this browser. */
export function hasValidSession(now: number = Date.now()): boolean {
  return evaluateStoredSession(now).state === 'valid';
}

/* -------------------------------------------------------------------------- */
/* Navigation helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Only same-origin absolute paths may be used as a post-login destination. */
export function sanitiseNextPath(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

export function buildLoginUrl(
  reason: LogoutReason | null,
  nextPath?: string | null,
  loginPath: string = '/'
): string {
  const params = new URLSearchParams();
  if (reason) params.set('session', reason);
  const safeNext = sanitiseNextPath(nextPath);
  if (safeNext && safeNext !== loginPath) params.set('next', safeNext);
  const query = params.toString();
  return query ? `${loginPath}?${query}` : loginPath;
}
