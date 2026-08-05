import { type ReactNode } from 'react';

export function Card({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={`bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-sm ${hover ? 'transition-all duration-300 hover:shadow-md hover:border-ink-200 dark:hover:border-ink-700 hover:-translate-y-0.5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  accent = 'ink',
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  accent?: 'ink' | 'accent' | 'sea' | 'forest' | 'coral';
}) {
  const accentMap = {
    ink: 'text-ink-900 dark:text-ink-100',
    accent: 'text-accent-600 dark:text-accent-400',
    sea: 'text-sea-600 dark:text-sea-400',
    forest: 'text-forest-600 dark:text-forest-400',
    coral: 'text-coral-600 dark:text-coral-400',
  };
  return (
    <Card className="p-5">
      <div className="text-xs font-medium text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold ${accentMap[accent]} tabular-nums`}>{value}</div>
      {sublabel && <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">{sublabel}</div>}
    </Card>
  );
}

export function Badge({ children, color = 'ink' }: { children: ReactNode; color?: 'ink' | 'accent' | 'sea' | 'forest' | 'coral' | 'slate' }) {
  const colorMap = {
    ink: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400',
    accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-400',
    sea: 'bg-sea-100 text-sea-700 dark:bg-sea-900/40 dark:text-sea-400',
    forest: 'bg-forest-100 text-forest-700 dark:bg-forest-900/40 dark:text-forest-400',
    coral: 'bg-coral-100 text-coral-700 dark:bg-coral-900/40 dark:text-coral-400',
    slate: 'bg-ink-200 text-ink-600 dark:bg-ink-800 dark:text-ink-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorMap[color]}`}>
      {children}
    </span>
  );
}
