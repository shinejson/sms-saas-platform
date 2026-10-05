'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_PERSIST_INTERVAL_MS,
  CLOCK_SKEW_MS,
  SESSION_IDLE_MINUTES,
  SESSION_KEYS,
  SESSION_WARNING_MS,
  TOKEN_REFRESH_THRESHOLD_RATIO,
  buildLoginUrl,
  clearSession,
  evaluateStoredSession,
  readLastActivity,
  sessionAbsoluteDeadline,
  tokenExpiresAt,
  tokenIdleWindowMs,
  writeLastActivity,
  writeTenant,
  writeToken,
  writeUser,
  type LogoutReason,
  type StoredTenant,
  type StoredUser,
} from '@/lib/session';

/**
 * Guards a protected page: verifies the session on mount, tracks the user's
 * last activity, slides the session forward while they work, warns before the
 * inactivity timeout and signs them out when it elapses.
 *
 * Why this exists: the dashboard used to render as soon as a `sms_token` key
 * existed in localStorage, so a token from weeks ago opened the app instantly
 * (then every API call quietly 401'd). Now nothing renders until the token has
 * been verified by the server, and an idle session is actively terminated.
 */

export type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

export interface UseSessionGuardOptions {
  /** Set false to disable the guard entirely (e.g. public pages). */
  enabled?: boolean;
  /** Roles allowed on this page. Empty/omitted means any authenticated user. */
  requiredRoles?: string[];
  /** Where to send signed-out users. `null` keeps the user on the page. */
  redirectTo?: string | null;
  /** Called whenever the session ends, with the reason. */
  onSessionEnd?: (reason: LogoutReason) => void;
}

export interface SessionGuardResult {
  status: SessionStatus;
  token: string | null;
  user: StoredUser | null;
  tenant: StoredTenant | null;
  /** Why the session ended (null while authenticated). */
  reason: LogoutReason | null;
  /** True while the "about to sign you out" countdown is running. */
  warningVisible: boolean;
  /** Seconds left before the automatic sign-out. */
  secondsRemaining: number;
  /** Epoch ms of the last recorded user activity. */
  lastActivityAt: number | null;
  /** Configured inactivity window, in minutes. */
  idleMinutes: number;
  /** "Stay signed in" - records activity and refreshes the token now. */
  extendSession: () => void;
  /** Ends the session (defaults to a manual sign-out). */
  signOut: (reason?: LogoutReason) => void;
  /** Re-reads the session from storage + server (used after a login). */
  reload: () => void;
}

/** Passive + intentional signals that the user is still at the keyboard. */
const PASSIVE_ACTIVITY_EVENTS = ['mousemove', 'scroll', 'wheel', 'pointermove'] as const;
const INTENTIONAL_ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'touchstart',
  'click',
  'submit',
  'change',
] as const;

/** API paths that must never trigger an automatic sign-out on 401. */
const AUTH_PATHS = ['/api/auth/login', '/api/auth/register-school', '/api/auth/logout'];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input?.url ?? '';
}

function isGuardedApiCall(url: string): boolean {
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
    if (!path.startsWith('/api/')) return false;
    return !AUTH_PATHS.some((auth) => path.startsWith(auth));
  } catch {
    return false;
  }
}

export function useSessionGuard(options: UseSessionGuardOptions = {}): SessionGuardResult {
  const { enabled = true, requiredRoles, redirectTo = '/', onSessionEnd } = options;

  const [internalStatus, setStatus] = useState<SessionStatus>('checking');
  // A disabled guard (public page) is always "authenticated" - derived, so no
  // state update is needed for it.
  const status: SessionStatus = enabled ? internalStatus : 'authenticated';
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tenant, setTenant] = useState<StoredTenant | null>(null);
  const [reason, setReason] = useState<LogoutReason | null>(null);
  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Mutable timing state - kept in refs so activity never re-renders the page.
  const tokenRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(0);
  const lastPersistRef = useRef<number>(0);
  const lastRefreshRef = useRef<number>(0);
  const refreshingRef = useRef<boolean>(false);
  const endedRef = useRef<boolean>(false);
  const warningRef = useRef<boolean>(false);
  const hiddenSinceRef = useRef<number | null>(null);

  // "Latest value" refs, synced after render so callbacks created once can
  // still reach the current props/handlers.
  const onSessionEndRef = useRef(onSessionEnd);
  useEffect(() => {
    onSessionEndRef.current = onSessionEnd;
  }, [onSessionEnd]);

  /* ---------------------------------------------------------------------- */
  /* Ending the session                                                      */
  /* ---------------------------------------------------------------------- */

  const endSession = useCallback(
    (
      endReason: LogoutReason | null,
      opts: { notifyServer?: boolean; redirect?: boolean } = {}
    ) => {
      if (endedRef.current) return;
      endedRef.current = true;

      const { notifyServer = true, redirect = true } = opts;
      const currentToken = tokenRef.current;

      // Best effort audit trail - never blocks the sign-out.
      if (notifyServer && currentToken && endReason) {
        try {
          void fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${currentToken}`,
            },
            body: JSON.stringify({ reason: endReason }),
            keepalive: true,
          }).catch(() => undefined);
        } catch {
          /* ignore */
        }
      }

      // A deliberate sign-out needs no explanation on the login screen, and
      // `null` means "there was never a session here" (first visit).
      const bannerReason = !endReason || endReason === 'manual' ? null : endReason;

      clearSession(bannerReason ?? undefined);
      tokenRef.current = null;
      warningRef.current = false;

      setToken(null);
      setUser(null);
      setTenant(null);
      setWarningVisible(false);
      setSecondsRemaining(0);
      setReason(endReason);
      setStatus('unauthenticated');

      if (endReason) onSessionEndRef.current?.(endReason);

      if (redirect && redirectTo && typeof window !== 'undefined') {
        // Remember where they were so signing in brings them straight back.
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = buildLoginUrl(bannerReason, next, redirectTo);
      }
    },
    [redirectTo]
  );

  const endSessionRef = useRef(endSession);
  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  /* ---------------------------------------------------------------------- */
  /* Token rotation (sliding inactivity window)                              */
  /* ---------------------------------------------------------------------- */

  const refreshToken = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken || refreshingRef.current || endedRef.current) return;

    refreshingRef.current = true;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({}),
      });

      if (res.status === 401 || res.status === 403) {
        const body = await res.json().catch(() => ({}));
        const serverReason = body?.reason as LogoutReason | undefined;
        // A 403 without a reason is not an authentication failure (e.g. the
        // CSRF/origin guard) - never sign the user out for that.
        if (res.status === 401 || serverReason) {
          endSessionRef.current(serverReason || 'expired');
        }
        return;
      }

      if (!res.ok) return; // transient failure - retry on the next tick

      const data = await res.json();
      if (data?.token) {
        tokenRef.current = data.token;
        lastRefreshRef.current = Date.now();
        writeToken(data.token);
        setToken(data.token);
        if (data.user) {
          writeUser(data.user);
          setUser(data.user);
        }
        if (data.tenant) {
          writeTenant(data.tenant);
          setTenant((prev) => ({ ...(prev || {}), ...data.tenant }));
        }
      }
    } catch {
      /* offline - the countdown still protects the session */
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  const refreshTokenRef = useRef(refreshToken);
  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  /* ---------------------------------------------------------------------- */
  /* Activity tracking                                                       */
  /* ---------------------------------------------------------------------- */

  const recordActivity = useCallback((opts: { force?: boolean } = {}) => {
    if (endedRef.current || !tokenRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;

    if (opts.force || now - lastPersistRef.current >= ACTIVITY_PERSIST_INTERVAL_MS) {
      lastPersistRef.current = now;
      writeLastActivity(now);
      setLastActivityAt(now);
    }

    if (warningRef.current) {
      warningRef.current = false;
      setWarningVisible(false);
      // The user came back - slide the server-side window immediately.
      void refreshTokenRef.current();
    }
  }, []);

  const recordActivityRef = useRef(recordActivity);
  useEffect(() => {
    recordActivityRef.current = recordActivity;
  }, [recordActivity]);

  const extendSession = useCallback(() => {
    recordActivityRef.current({ force: true });
    void refreshTokenRef.current();
  }, []);

  const signOut = useCallback(
    (manualReason: LogoutReason = 'manual') => endSessionRef.current(manualReason),
    []
  );

  const reload = useCallback(() => {
    endedRef.current = false;
    setStatus('checking');
    setReloadKey((key) => key + 1);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Mount: local pre-flight + server verification                           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    endedRef.current = false;

    const verify = async () => {
      // 1. Local pre-flight: is there a token, is it still inside its expiry
      //    and has the user been active inside the inactivity window?
      const evaluation = evaluateStoredSession();

      if (evaluation.state === 'none') {
        // Never signed in on this browser (or already signed out elsewhere).
        endSessionRef.current(null, { notifyServer: false });
        return;
      }

      if (evaluation.state === 'invalid') {
        // Expired or idle-timed-out before the page even rendered. This is the
        // case that used to slip through and open the dashboard.
        endSessionRef.current(evaluation.reason, { notifyServer: false });
        return;
      }

      tokenRef.current = evaluation.token;
      lastActivityRef.current = evaluation.lastActivityAt || Date.now();
      lastPersistRef.current = 0;
      setToken(evaluation.token);
      setUser(evaluation.user);
      setTenant(evaluation.tenant);

      // 2. Server is the authority: signature, expiry, account + tenant status.
      try {
        const res = await fetch('/api/auth/session', {
          headers: { Authorization: `Bearer ${evaluation.token}` },
          cache: 'no-store',
        });

        if (cancelled) return;

        if (res.status === 401 || res.status === 403) {
          const body = await res.json().catch(() => ({}));
          endSessionRef.current((body?.reason as LogoutReason) || 'expired', { notifyServer: false });
          return;
        }

        if (!res.ok) {
          // Server trouble (5xx): keep the locally valid session rather than
          // throwing the user out over a blip.
          setStatus('authenticated');
          recordActivityRef.current({ force: true });
          return;
        }

        const data = await res.json();

        if (requiredRoles?.length && !requiredRoles.includes(data?.user?.role)) {
          endSessionRef.current('forbidden', { notifyServer: false });
          return;
        }

        if (data?.user) {
          writeUser(data.user);
          setUser(data.user);
        }
        if (data?.tenant) {
          writeTenant(data.tenant);
          setTenant((prev) => ({ ...(prev || {}), ...data.tenant }));
        }

        recordActivityRef.current({ force: true });
        setReason(null);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        // Network failure: trust the local (still valid) token.
        setStatus('authenticated');
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
    // requiredRoles is intentionally compared by content, not identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadKey, requiredRoles?.join('|')]);

  /* ---------------------------------------------------------------------- */
  /* Activity listeners                                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled || status !== 'authenticated') return;

    const onPassive = () => {
      // While the countdown dialog is up we require a deliberate action, so a
      // nudged mouse cannot silently keep an unattended session alive.
      if (warningRef.current) return;
      recordActivityRef.current();
    };
    const onIntentional = () => recordActivityRef.current();

    PASSIVE_ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onPassive, { passive: true })
    );
    INTENTIONAL_ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onIntentional, { passive: true })
    );

    return () => {
      PASSIVE_ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onPassive));
      INTENTIONAL_ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onIntentional));
    };
  }, [enabled, status]);

  /* ---------------------------------------------------------------------- */
  /* The clock: idle countdown, expiry enforcement, token rotation           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled || status !== 'authenticated') return;

    const tick = () => {
      const currentToken = tokenRef.current;
      if (!currentToken || endedRef.current) return;

      const now = Date.now();
      const expiry = tokenExpiresAt(currentToken);
      const absolute = sessionAbsoluteDeadline(currentToken);
      const idleWindow = tokenIdleWindowMs(currentToken);
      const idleDeadline = lastActivityRef.current + idleWindow;

      if (absolute !== null && now >= absolute) {
        endSessionRef.current('expired');
        return;
      }

      // Inactivity wins: sign the user out at the idle deadline even if the
      // token itself would survive a little longer.
      if (now >= idleDeadline) {
        endSessionRef.current('inactivity');
        return;
      }

      if (expiry !== null && now >= expiry - CLOCK_SKEW_MS) {
        endSessionRef.current('expired');
        return;
      }

      const deadline = Math.min(idleDeadline, expiry ?? idleDeadline, absolute ?? idleDeadline);
      const msLeft = deadline - now;

      if (msLeft <= SESSION_WARNING_MS) {
        const seconds = Math.max(0, Math.ceil(msLeft / 1000));
        if (!warningRef.current) {
          warningRef.current = true;
          setWarningVisible(true);
        }
        setSecondsRemaining((prev) => (prev === seconds ? prev : seconds));
      } else if (warningRef.current) {
        warningRef.current = false;
        setWarningVisible(false);
      }

      // Slide the server-side window, but only for a user who is genuinely
      // working: an abandoned tab must let its token die on schedule.
      const activeSinceLastRefresh = lastActivityRef.current > lastRefreshRef.current;
      const recentlyActive = now - lastActivityRef.current < idleWindow * TOKEN_REFRESH_THRESHOLD_RATIO;
      const tokenHalfSpent =
        expiry !== null && expiry - now < idleWindow * TOKEN_REFRESH_THRESHOLD_RATIO;

      if (
        recentlyActive &&
        activeSinceLastRefresh &&
        tokenHalfSpent &&
        now - lastRefreshRef.current > 30_000
      ) {
        void refreshTokenRef.current();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [enabled, status]);

  /* ---------------------------------------------------------------------- */
  /* Cross-tab sync                                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled || status !== 'authenticated') return;

    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEYS.token) {
        if (!event.newValue) {
          // Signed out in another tab.
          endSessionRef.current('other-tab', { notifyServer: false });
        } else {
          tokenRef.current = event.newValue;
          setToken(event.newValue);
        }
        return;
      }

      if (event.key === SESSION_KEYS.lastActivity && event.newValue) {
        const stamp = Number(event.newValue);
        if (Number.isFinite(stamp) && stamp > lastActivityRef.current) {
          // Active in another tab counts as active here too.
          lastActivityRef.current = stamp;
          lastPersistRef.current = stamp;
          setLastActivityAt(stamp);
          if (warningRef.current) {
            warningRef.current = false;
            setWarningVisible(false);
          }
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [enabled, status]);

  /* ---------------------------------------------------------------------- */
  /* Re-check after the tab was hidden (sleep / long background)             */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled || status !== 'authenticated') return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
        return;
      }

      const hiddenSince = hiddenSinceRef.current;
      hiddenSinceRef.current = null;

      // Another tab may have refreshed the token or recorded activity.
      const storedActivity = readLastActivity();
      if (storedActivity && storedActivity > lastActivityRef.current) {
        lastActivityRef.current = storedActivity;
        setLastActivityAt(storedActivity);
      }

      const evaluation = evaluateStoredSession();
      if (evaluation.state === 'invalid') {
        endSessionRef.current(evaluation.reason, { notifyServer: false });
        return;
      }
      if (evaluation.state === 'none') {
        endSessionRef.current('other-tab', { notifyServer: false });
        return;
      }

      tokenRef.current = evaluation.token;
      setToken(evaluation.token);

      // Laptop lid closed for a while: re-validate with the server.
      if (hiddenSince && Date.now() - hiddenSince > 60_000) {
        void (async () => {
          try {
            const res = await fetch('/api/auth/session', {
              headers: { Authorization: `Bearer ${evaluation.token}` },
              cache: 'no-store',
            });
            if (res.status === 401 || res.status === 403) {
              const body = await res.json().catch(() => ({}));
              endSessionRef.current((body?.reason as LogoutReason) || 'expired', {
                notifyServer: false,
              });
            }
          } catch {
            /* offline - local timers still apply */
          }
        })();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, status]);

  /* ---------------------------------------------------------------------- */
  /* Global 401 interception                                                 */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled || status !== 'authenticated' || typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    if ((originalFetch as unknown as { __smsSessionGuard?: boolean }).__smsSessionGuard) return;

    const guarded = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      try {
        if (
          (response.status === 401 || response.status === 403) &&
          isGuardedApiCall(requestUrl(input))
        ) {
          const probe = response.clone();
          const body = await probe.json().catch(() => null);
          const serverReason = body?.reason as LogoutReason | undefined;
          // Only end the session for authentication failures. A 403 about
          // page permissions must not log anybody out.
          if (response.status === 401 || serverReason === 'suspended') {
            endSessionRef.current(serverReason || 'expired', { notifyServer: false });
          }
        }
      } catch {
        /* never let the interceptor break a request */
      }
      return response;
    };

    (guarded as unknown as { __smsSessionGuard?: boolean }).__smsSessionGuard = true;
    window.fetch = guarded as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, [enabled, status]);

  return {
    status,
    token,
    user,
    tenant,
    reason,
    warningVisible,
    secondsRemaining,
    lastActivityAt,
    idleMinutes: SESSION_IDLE_MINUTES,
    extendSession,
    signOut,
    reload,
  };
}

export default useSessionGuard;
