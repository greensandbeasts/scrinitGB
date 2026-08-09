import { type ReactNode, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 shadow-sm dark:bg-ink-100 dark:text-ink-950 dark:hover:bg-white',
  secondary: 'bg-white text-ink-900 border border-ink-200 hover:border-ink-300 hover:bg-ink-50 shadow-sm dark:bg-ink-800 dark:text-ink-100 dark:border-ink-700 dark:hover:border-ink-600 dark:hover:bg-ink-700',
  ghost: 'text-ink-600 hover:text-ink-900 hover:bg-ink-100 dark:text-ink-400 dark:hover:text-white dark:hover:bg-ink-800',
  danger: 'bg-coral-600 text-white hover:bg-coral-700 active:bg-coral-800 shadow-sm',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
};

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 focus:ring-offset-2 dark:focus:ring-offset-ink-950 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
