import { useState, useEffect } from 'react';
import { BookOpen, ArrowLeft, Mail, Lock, User, Building2, ArrowRight, PenTool, Eye } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import type { SelectableRole } from '@/lib/types';
import { ROLE_DESCRIPTIONS, SELECTABLE_ROLE_LABELS } from '@/lib/types';

interface AuthPageProps {
  navigate: (to: string) => void;
}

export function AuthPage({ navigate }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<SelectableRole>('writer');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    if (params.get('mode') === 'signup') setMode('signup');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, {
        display_name: displayName || email.split('@')[0],
        role,
        company: company || undefined,
      });
      if (error) setError(error);
    }
    setLoading(false);
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('scrinit2026');
    setMode('signin');
    setError(null);
  };

  const ROLE_ICONS: Record<SelectableRole, typeof User> = {
    writer: PenTool,
    reader: Eye,
    industry: Building2,
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ink-50 dark:bg-ink-950">
      {/* Left panel — brand / context */}
      <div className="lg:w-2/5 bg-ink-900 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
        <div className="relative">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-ink-400 hover:text-white transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to home</span>
          </button>
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent-400" />
            </div>
            <span className="font-bold text-xl">Scrinit</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">
            {mode === 'signin' ? 'Welcome back to the home of audience intelligence.' : 'Join Scrinit and let real readers prove your screenplay.'}
          </h1>
          <p className="text-ink-300 leading-relaxed">
            {mode === 'signin'
              ? 'Sign in to access your dashboard, reading assignments, or discovery feed.'
              : 'Create an account to upload screenplays, read anonymously, or discover scripts backed by evidence.'}
          </p>
        </div>

        <div className="relative mt-12 space-y-2">
          <div className="text-xs text-ink-400 uppercase tracking-wider mb-3">Quick demo access</div>
          {[
            { email: 'writer@scrinit.demo', label: 'Writer — Elena Marsh' },
            { email: 'reader@scrinit.demo', label: 'Reader — Marcus Cole' },
            { email: 'industry@scrinit.demo', label: 'Industry — Sofia Reyes' },
            { email: 'admin@scrinit.demo', label: 'Admin — Platform' },
          ].map((d) => (
            <button
              key={d.email}
              onClick={() => fillDemo(d.email)}
              className="block w-full text-left text-sm text-ink-300 hover:text-accent-400 transition-colors py-1"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="lg:w-3/5 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="flex gap-1 p-1 bg-ink-100 dark:bg-ink-800 rounded-xl mb-8">
            <button
              onClick={() => { setMode('signin'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'signin' ? 'bg-white dark:bg-ink-100 text-ink-900 dark:text-ink-950 shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'}`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'signup' ? 'bg-white dark:bg-ink-100 text-ink-900 dark:text-ink-950 shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'}`}
            >
              Create account
            </button>
          </div>

          <h2 className="text-2xl font-bold text-ink-900 dark:text-white mb-1">
            {mode === 'signin' ? 'Sign in to Scrinit' : 'Create your account'}
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-8">
            {mode === 'signin' ? 'Enter your credentials to continue.' : 'Choose your role and start in minutes.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Display name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-2">I am a...</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['writer', 'reader', 'industry'] as SelectableRole[]).map((r) => {
                      const Icon = ROLE_ICONS[r];
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${role === r ? 'border-ink-900 dark:border-white bg-ink-50 dark:bg-ink-800' : 'border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600'}`}
                        >
                          <Icon className={`w-5 h-5 mx-auto mb-1.5 ${role === r ? 'text-ink-900 dark:text-white' : 'text-ink-400'}`} />
                          <div className={`text-sm font-semibold ${role === r ? 'text-ink-900 dark:text-white' : 'text-ink-500 dark:text-ink-400'}`}>{SELECTABLE_ROLE_LABELS[r]}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-ink-400 dark:text-ink-500 mt-2">{ROLE_DESCRIPTIONS[role]}</p>
                </div>

                {role === 'industry' && (
                  <div>
                    <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Company</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Production company, agency, etc."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm animate-slide-down">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <p className="text-xs text-ink-400 dark:text-ink-500 text-center mt-6">
            Demo accounts use password <span className="font-mono font-medium text-ink-600 dark:text-ink-300">scrinit2026</span>
          </p>
        </div>
      </div>
    </div>
  );
}
