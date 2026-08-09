import { useEffect, useState } from 'react';
import { Users, BookOpen, BarChart3, TrendingUp, Star, ThumbsUp, Activity, BookMarked } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, StatCard, Badge } from '@/components/ui/Card';
import { getCoverColor, relativeTime, type ScreenplayDiscovery, type Profile } from '@/lib/types';

interface AdminOverviewProps {
  navigate: (to: string) => void;
}

export function AdminOverview({ navigate }: AdminOverviewProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [screenplays, setScreenplays] = useState<ScreenplayDiscovery[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [profileRes, spRes, sessRes, fbRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('screenplay_discovery').select('*').order('reader_count', { ascending: false }),
        supabase.from('reading_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('reader_feedback').select('id', { count: 'exact', head: true }),
      ]);
      setProfiles((profileRes.data as Profile[]) ?? []);
      setScreenplays((spRes.data as ScreenplayDiscovery[]) ?? []);
      setTotalSessions(sessRes.count ?? 0);
      setTotalFeedback(fbRes.count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading platform data...</div>;
  }

  const writers = profiles.filter((p) => p.role === 'writer');
  const readers = profiles.filter((p) => p.role === 'reader');
  const industry = profiles.filter((p) => p.role === 'industry');
  const totalReaders = screenplays.reduce((sum, s) => sum + s.reader_count, 0);
  const avgCompletion = screenplays.length > 0
    ? Math.round(screenplays.reduce((sum, s) => sum + s.completion_rate, 0) / screenplays.length)
    : 0;
  const avgRating = screenplays.length > 0
    ? (screenplays.reduce((sum, s) => sum + s.avg_rating, 0) / screenplays.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Platform overview</h1>
        <p className="text-ink-500 dark:text-ink-400 dark:text-ink-500 mt-1">Monitor activity, users, and engagement across Scrinit.</p>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total users" value={profiles.length} sublabel={`${writers.length} writers · ${readers.length} readers · ${industry.length} industry`} accent="ink" />
        <StatCard label="Screenplays" value={screenplays.length} sublabel="published" accent="sea" />
        <StatCard label="Reading sessions" value={totalSessions} sublabel={`${totalFeedback} feedback submissions`} accent="forest" />
        <StatCard label="Total readers" value={totalReaders} sublabel="across all screenplays" accent="accent" />
      </div>

      {/* Engagement summary */}
      <div className="grid lg:grid-cols-3 gap-4">
        <StatCard label="Avg completion" value={`${avgCompletion}%`} sublabel="across all screenplays" accent="forest" />
        <StatCard label="Avg rating" value={avgRating} sublabel={`${totalFeedback} total reviews`} accent="accent" />
        <StatCard label="Avg confidence" value={screenplays.length > 0 ? Math.round(screenplays.reduce((s, sp) => s + sp.confidence_score, 0) / screenplays.length) : 0} sublabel="confidence score" accent="sea" />
      </div>

      {/* Top screenplays */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink-900 dark:text-white">Top screenplays by engagement</h2>
          <button onClick={() => navigate('/admin/screenplays')} className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 hover:text-ink-900 dark:text-white transition-colors">
            View all
          </button>
        </div>
        <div className="space-y-3">
          {screenplays.slice(0, 5).map((sp, i) => {
            const colors = getCoverColor(sp.cover_color);
            return (
              <Card key={sp.id} hover className="p-4 cursor-pointer" >
                <div onClick={() => navigate(`/industry/screenplay/${sp.id}`)} className="flex items-center gap-4">
                  <span className="text-sm font-bold text-ink-300 tabular-nums w-6">{i + 1}</span>
                  <div className={`w-10 h-13 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-sm`}>
                    <BookOpen className="w-4 h-4 text-white/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ink-900 dark:text-white truncate">{sp.title}</h3>
                      <Badge color="ink">{sp.genre}</Badge>
                    </div>
                    <p className="text-xs text-ink-400 dark:text-ink-500">by {sp.writer_name}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-5 text-xs">
                    <span className="flex items-center gap-1 text-ink-600 dark:text-ink-300"><Users className="w-3.5 h-3.5" /> {sp.reader_count}</span>
                    <span className="flex items-center gap-1 text-forest-600"><TrendingUp className="w-3.5 h-3.5" /> {sp.completion_rate}%</span>
                    <span className="flex items-center gap-1 text-accent-600"><Star className="w-3.5 h-3.5" /> {sp.avg_rating}</span>
                    <span className="flex items-center gap-1 text-sea-600"><ThumbsUp className="w-3.5 h-3.5" /> {sp.recommend_rate}%</span>
                  </div>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="text-lg font-bold text-ink-900 dark:text-white tabular-nums">{sp.confidence_score}</div>
                    <div className="text-[10px] text-ink-400 dark:text-ink-500 uppercase tracking-wider">Confidence</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent users */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink-900 dark:text-white">Recent users</h2>
          <button onClick={() => navigate('/admin/users')} className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 hover:text-ink-900 dark:text-white transition-colors">
            View all
          </button>
        </div>
        <Card className="p-6">
          <div className="space-y-2">
            {profiles.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-ink-50 last:border-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
                  p.avatar_color === 'amber' ? 'bg-accent-500' : p.avatar_color === 'sky' ? 'bg-sea-500' : p.avatar_color === 'emerald' ? 'bg-forest-500' : p.avatar_color === 'rose' ? 'bg-coral-500' : 'bg-ink-50 dark:bg-ink-950'
                }`}>
                  {p.display_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{p.display_name}</div>
                  <div className="text-xs text-ink-400 dark:text-ink-500 truncate">{p.email}</div>
                </div>
                <Badge color={
                  p.role === 'writer' ? 'accent' :
                  p.role === 'reader' ? 'sea' :
                  p.role === 'industry' ? 'forest' : 'slate'
                }>{p.role}</Badge>
                <span className="text-xs text-ink-400 dark:text-ink-500 flex-shrink-0">{relativeTime(p.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
