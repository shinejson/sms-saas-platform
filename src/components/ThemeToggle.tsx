'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Dark/light switch shared by every page. The selected theme is stored globally
 * (see ThemeProvider) so it persists across navigation.
 */
export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title="Toggle Theme"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition active:scale-95 ${
        isDark
          ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
      } ${className}`}
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}