'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sms_theme';

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/*                                                                             */
/* The theme lives outside React (a class on <html> plus localStorage), so it  */
/* is modelled as a tiny external store and read through useSyncExternalStore. */
/* -------------------------------------------------------------------------- */

const listeners = new Set<() => void>();

/** Cached so getSnapshot() stays referentially stable between renders. */
let currentTheme: Theme | null = null;

/** Resolve the theme the pre-paint script in the root layout already applied. */
function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getTheme(): Theme {
  if (currentTheme === null) currentTheme = readInitialTheme();
  return currentTheme;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

/** Apply the theme by toggling `.dark` on <html>, which Tailwind's dark: variant keys off. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // Let the browser render native widgets (scrollbars, form controls) to match.
  root.style.colorScheme = theme;
}

export function setStoredTheme(theme: Theme) {
  currentTheme = theme;
  applyTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode / quota) — theme still applies for this session.
  }
  emit();
}

/**
 * Runs before paint to set the `.dark` class from localStorage, avoiding a
 * flash of the wrong theme on first render. Keep in sync with readInitialTheme().
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;}catch(e){}})();`;

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const SERVER_THEME: Theme = 'light';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => SERVER_THEME);

  // Keep other tabs of the same app in sync when the theme changes there.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next: Theme = event.newValue === 'dark' ? 'dark' : 'light';
      if (next !== getTheme()) {
        currentTheme = next;
        applyTheme(next);
        emit();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setStoredTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setStoredTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}