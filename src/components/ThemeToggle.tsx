'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from './icons';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-700 backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
    >
      {theme === 'dark' ? <Moon width={18} height={18} /> : <Sun width={18} height={18} />}
    </button>
  );
}
