import { BookOpen, BarChart3, Eye, TrendingUp, Users, Shield, ArrowRight, Sparkles, Check, Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme';

interface LandingPageProps {
  navigate: (to: string) => void;
}

export function LandingPage({ navigate }: LandingPageProps) {
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const { theme, cycleTheme } = useTheme();

  const quickSignIn = async (email: string, key: string) => {
    setDemoLoading(key);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'scrinit2026',
    });
    if (error) {
      setDemoLoading(null);
      return;
    }
  };

  const themeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-ink-950/80 backdrop-blur-xl border-b border-ink-100 dark:border-ink-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ink-900 dark:bg-white flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-accent-400" />
            </div>
            <span className="font-bold text-lg text-ink-900 dark:text-white tracking-tight">Scrinit</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-600 dark:text-ink-300">
            <a href="#how" className="hover:text-ink-900 dark:hover:text-white transition-colors">How it works</a>
            <a href="#roles" className="hover:text-ink-900 dark:hover:text-white transition-colors">For your role</a>
            <a href="#evidence" className="hover:text-ink-900 dark:hover:text-white transition-colors">The evidence</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cycleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-ink-800 transition-all text-sm font-medium"
              title={`Theme: ${theme}`}
            >
              {themeIcon === Sun && <Sun className="w-4 h-4" />}
              {themeIcon === Moon && <Moon className="w-4 h-4" />}
              {themeIcon === Monitor && <Monitor className="w-4 h-4" />}
              <span className="hidden sm:inline capitalize">{theme}</span>
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Sign in</Button>
            <Button size="sm" onClick={() => navigate('/auth?mode=signup')}>Get started</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden bg-white dark:bg-ink-950">
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 text-sm font-medium mb-8 animate-slide-down">
            <Sparkles className="w-3.5 h-3.5 text-accent-500" />
            Audience intelligence for screenplays
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-ink-900 dark:text-white tracking-tight leading-[1.05] mb-6 animate-slide-up">
            Discover screenplays<br />
            through real reader behaviour,
            <span className="text-ink-400 dark:text-ink-500"> not opinions.</span>
          </h1>
          <p className="text-lg md:text-xl text-ink-500 dark:text-ink-400 max-w-2xl mx-auto leading-relaxed mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Scrinit measures how independent readers actually engage with screenplays — reading progression, completion, return sessions, and recommendations — to build evidence-backed engagement profiles that writers and industry professionals can trust.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Button size="lg" onClick={() => navigate('/auth?mode=signup')}>
              Start with Scrinit
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('/auth')}>
              Explore the platform
            </Button>
          </div>
        </div>

        {/* Hero visual: engagement dashboard preview */}
        <div className="relative max-w-5xl mx-auto mt-20 animate-scale-in" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-2xl shadow-ink-900/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-coral-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-accent-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-forest-300" />
              </div>
              <span className="text-xs text-ink-400 dark:text-ink-500 ml-2 font-mono">scrinit.app / writer / the-lighthouse-keepers</span>
            </div>
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">Screenplay engagement profile</div>
                  <h3 className="text-2xl font-bold text-ink-900 dark:text-white">The Lighthouse Keepers</h3>
                  <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Thriller by Elena Marsh</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-forest-50 dark:bg-forest-900/20 text-forest-700 dark:text-forest-400 text-sm font-medium">
                  <TrendingUp className="w-4 h-4" />
                  80% completion
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Readers', value: '5', accent: 'text-ink-900 dark:text-white' },
                  { label: 'Completed', value: '4', accent: 'text-forest-600 dark:text-forest-400' },
                  { label: 'Recommend', value: '100%', accent: 'text-accent-600 dark:text-accent-400' },
                  { label: 'Avg rating', value: '8.5', accent: 'text-sea-600 dark:text-sea-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
                    <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">{stat.label}</div>
                    <div className={`text-2xl font-bold ${stat.accent} tabular-nums`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Retention curve preview */}
              <div>
                <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-3">Reader retention by page</div>
                <div className="flex items-end gap-1.5 h-24">
                  {[100, 100, 100, 80, 80, 80, 80, 80].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-accent-500 to-accent-300 transition-all duration-700"
                        style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
                      />
                      <span className="text-[10px] text-ink-300 dark:text-ink-600 font-mono">{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 bg-ink-50 dark:bg-ink-900 border-y border-ink-100 dark:border-ink-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-sm font-medium text-accent-600 dark:text-accent-400 uppercase tracking-wider mb-3">How it works</div>
            <h2 className="text-3xl md:text-4xl font-bold text-ink-900 dark:text-white mb-4">From script to evidence</h2>
            <p className="text-lg text-ink-500 dark:text-ink-400 max-w-2xl mx-auto">Every screenplay on Scrinit goes through the same rigorous process — designed to capture genuine audience response.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: 'Writers upload', desc: 'Screenwriters upload their PDF screenplays to Scrinit. Scripts remain protected — only metadata is public.' },
              { icon: Eye, title: 'Readers engage', desc: 'Independent readers receive anonymous assignments. The platform silently records how they read: progression, stops, returns, and decisions.' },
              { icon: BarChart3, title: 'Evidence emerges', desc: 'Reading signals generate engagement profiles. The more independent readers, the higher the confidence in the analysis.' },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="w-12 h-12 rounded-xl bg-ink-900 dark:bg-white flex items-center justify-center mb-5">
                  <step.icon className="w-5 h-5 text-accent-400" />
                </div>
                <div className="text-xs font-mono text-ink-300 dark:text-ink-600 mb-2">0{i + 1}</div>
                <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-ink-500 dark:text-ink-400 leading-relaxed">{step.desc}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-6 -right-4 text-ink-200 dark:text-ink-700">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Signals */}
      <section id="evidence" className="py-24 px-6 bg-white dark:bg-ink-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-sm font-medium text-accent-600 dark:text-accent-400 uppercase tracking-wider mb-3">The evidence</div>
            <h2 className="text-3xl md:text-4xl font-bold text-ink-900 dark:text-white mb-4">Seven behavioural signals</h2>
            <p className="text-lg text-ink-500 dark:text-ink-400 max-w-2xl mx-auto">Scrinit does not ask readers if they liked a screenplay. It measures what they actually did.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Reading progression', desc: 'How far each reader advances through the script' },
              { label: 'Continue or stop', desc: 'Whether readers choose to keep going at each checkpoint' },
              { label: 'Stopping points', desc: 'The exact pages where readers pause or abandon' },
              { label: 'Return sessions', desc: 'Whether readers come back after stopping' },
              { label: 'Completion rate', desc: 'The percentage of readers who reach the final page' },
              { label: 'Recommendation', desc: 'Whether readers would recommend the screenplay' },
              { label: 'Reader feedback', desc: 'Structured ratings across story, characters, pacing, dialogue' },
              { label: 'Confidence score', desc: 'A measure of statistical confidence based on reader volume' },
            ].map((signal, i) => (
              <div key={i} className="bg-ink-50 dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-5 hover:border-ink-200 dark:hover:border-ink-700 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center mb-3">
                  <Check className="w-4 h-4 text-accent-600 dark:text-accent-400" />
                </div>
                <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-1">{signal.label}</h3>
                <p className="text-xs text-ink-500 dark:text-ink-400 leading-relaxed">{signal.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-24 px-6 bg-ink-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-sm font-medium text-accent-400 uppercase tracking-wider mb-3">For your role</div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Four ways to use Scrinit</h2>
            <p className="text-lg text-ink-300 max-w-2xl mx-auto">Every role sees a different side of the same evidence.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: BookOpen, title: 'Writer', desc: 'Upload screenplays. Track audience engagement, retention, and confidence. See exactly where readers stop and why.' },
              { icon: Eye, title: 'Reader', desc: 'Receive anonymous assignments. Read screenplays in a distraction-free interface. Provide structured feedback.' },
              { icon: BarChart3, title: 'Industry', desc: 'Discover screenplays backed by real audience data. Search, filter, compare engagement profiles. Request access.' },
              { icon: Shield, title: 'Admin', desc: 'Manage users, screenplays, and platform settings. Monitor engagement algorithms and platform analytics.' },
            ].map((role, i) => (
              <div key={i} className="bg-ink-800/50 rounded-2xl border border-ink-700 p-6 hover:bg-ink-800 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-ink-700 flex items-center justify-center mb-4">
                  <role.icon className="w-5 h-5 text-accent-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{role.title}</h3>
                <p className="text-sm text-ink-300 leading-relaxed">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo accounts */}
      <section className="py-20 px-6 bg-white dark:bg-ink-900 border-b border-ink-100 dark:border-ink-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forest-50 dark:bg-forest-900/20 text-forest-700 dark:text-forest-400 text-sm font-medium mb-6">
            <Users className="w-3.5 h-3.5" />
            Explore with demo accounts
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-ink-900 dark:text-white mb-3">See Scrinit from every perspective</h2>
          <p className="text-ink-500 dark:text-ink-400 mb-10 max-w-xl mx-auto">Jump straight into any role with pre-loaded screenplays, reader assignments, and engagement data.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              { key: 'writer', label: 'Writer', email: 'writer@scrinit.demo', desc: 'Elena Marsh', color: 'bg-accent-50 dark:bg-accent-900/20 hover:bg-accent-100 dark:hover:bg-accent-900/40 text-accent-700 dark:text-accent-400 border-accent-200 dark:border-accent-800' },
              { key: 'reader', label: 'Reader', email: 'reader@scrinit.demo', desc: 'Marcus Cole', color: 'bg-sea-50 dark:bg-sea-900/20 hover:bg-sea-100 dark:hover:bg-sea-900/40 text-sea-700 dark:text-sea-400 border-sea-200 dark:border-sea-800' },
              { key: 'industry', label: 'Industry', email: 'industry@scrinit.demo', desc: 'Sofia Reyes', color: 'bg-forest-50 dark:bg-forest-900/20 hover:bg-forest-100 dark:hover:bg-forest-900/40 text-forest-700 dark:text-forest-400 border-forest-200 dark:border-forest-800' },
              { key: 'admin', label: 'Admin', email: 'admin@scrinit.demo', desc: 'Platform', color: 'bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200 border-ink-200 dark:border-ink-700' },
            ].map((demo) => (
              <button
                key={demo.key}
                onClick={() => quickSignIn(demo.email, demo.key)}
                disabled={demoLoading !== null}
                className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${demo.color}`}
              >
                <span className="font-semibold text-sm">{demo.label}</span>
                <span className="text-xs opacity-70">{demo.desc}</span>
                {demoLoading === demo.key ? (
                  <span className="text-xs mt-1 animate-pulse">Signing in...</span>
                ) : (
                  <span className="text-xs mt-1 opacity-50">Click to enter</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-ink-50 dark:bg-ink-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-ink-900 dark:bg-white flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-accent-400" />
            </div>
            <span className="font-bold text-ink-900 dark:text-white">Scrinit</span>
            <span className="text-sm text-ink-400 dark:text-ink-500 ml-2">Audience intelligence for screenplays</span>
          </div>
          <div className="text-sm text-ink-400 dark:text-ink-500">Built for screenwriters, producers, agents, and investors.</div>
        </div>
      </footer>
    </div>
  );
}
