'use client';

import React from 'react';

interface SessionCheckingScreenProps {
  /** Shown under the spinner. */
  message?: string;
}

/**
 * Full-screen placeholder rendered while the stored token is being verified.
 * Protected pages must not render any data before this resolves - that is what
 * used to let an expired session "open" the dashboard.
 */
export default function SessionCheckingScreen({
  message = 'Checking your session…',
}: SessionCheckingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
      <div
        className="w-10 h-10 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 dark:border-t-blue-400 animate-spin"
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{message}</p>
      <span className="sr-only" role="status">
        {message}
      </span>
    </div>
  );
}
