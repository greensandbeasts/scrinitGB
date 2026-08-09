import { type ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'ink' | 'accent' | 'sea' | 'forest' | 'coral' | 'slate';
}

export function Badge({ children, color = 'ink' }: BadgeProps) {
  const colorMap = {
    ink: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400',
    accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-400',
    sea: 'bg-sea-100 text-sea-700 dark:bg-sea-900/40 dark:text-sea-400',
    forest: 'bg-forest-100 text-forest-700 dark:bg-forest-900/40 dark:text-forest-400',
    coral: 'bg-coral-100 text-coral-700 dark:bg-coral-900/40 dark:text-coral-400',
    slate: 'bg-ink-200 text-ink-600 dark:bg-ink-800 dark:text-ink-400',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${colorMap[color]}`}>
      {children}
    </span>
  );
}
