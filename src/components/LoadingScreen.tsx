import { Loader2 } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-ink-900 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent-400 animate-spin" />
        </div>
        <p className="text-sm text-ink-400 font-medium">Loading Scrinit</p>
      </div>
    </div>
  );
}
