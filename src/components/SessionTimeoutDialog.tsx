'use client';

import React, { useEffect, useRef } from 'react';

interface SessionTimeoutDialogProps {
  open: boolean;
  /** Seconds left before the automatic sign-out. */
  secondsRemaining: number;
  /** Configured inactivity window, shown for context. */
  idleMinutes: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`;
}

/**
 * Inactivity warning shown shortly before the session is terminated, so work
 * in progress is never lost without notice.
 */
export default function SessionTimeoutDialog({
  open,
  secondsRemaining,
  idleMinutes,
  onStaySignedIn,
  onSignOut,
}: SessionTimeoutDialogProps) {
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) stayButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-description"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2
              id="session-timeout-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              Still there?
            </h2>
            <p
              id="session-timeout-description"
              className="mt-1 text-sm text-slate-600 dark:text-slate-300"
            >
              For your security you are signed out after {idleMinutes} minutes without activity.
              Your session ends in{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                {formatCountdown(secondsRemaining)}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Sign out now
          </button>
          <button
            ref={stayButtonRef}
            type="button"
            onClick={onStaySignedIn}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
