import { type ReactNode } from 'react';

export function Dialog({ 
  open, 
  onClose, 
  children, 
  className = '' 
}: { 
  open: boolean; 
  onClose: () => void; 
  children: ReactNode; 
  className?: string; 
}) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      />
      {/* Dialog */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none`}>
        <div className={`relative pointer-events-auto max-w-2xl w-full max-h-[90vh] overflow-y-auto ${className}`}>
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-lg w-full max-w-lg">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}