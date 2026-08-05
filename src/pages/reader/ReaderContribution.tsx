import { useEffect, useState } from 'react';
import { Award, TrendingUp, Upload, History, Gift, Zap, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, StatCard, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  type ReaderContributionBalance, type ContributionEvent, type CreditTransaction,
  type ContributionAlgorithmVersion, type Screenplay, relativeTime,
} from '@/lib/types';

interface ReaderContributionProps {
  navigate: (to: string) => void;
}

export function ReaderContribution({ navigate }: ReaderContributionProps) {
  const { profile } = useAuth();
  const [balance, setBalance] = useState<ReaderContributionBalance | null>(null);
  const [events, setEvents] = useState<(ContributionEvent & { screenplay?: Screenplay })[]>([]);
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [config, setConfig] = useState<ContributionAlgorithmVersion | null>(null);
  const [stats, setStats] = useState({ completed: 0, abandoned: 0, feedback: 0, totalPoints: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'history' | 'credits'>('overview');

  useEffect(() => {
    async function load() {
      if (!profile) return;

      const [balanceRes, eventsRes, creditsRes, configRes, assignRes, fbRes] = await Promise.all([
        supabase.rpc('get_or_create_balance', { p_reader_id: profile.id }),
        supabase.from('contribution_events').select('*').eq('reader_id', profile.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('credit_transactions').select('*').eq('reader_id', profile.id).order('created_at', { ascending: false }).limit(20),
        supabase.rpc('get_algorithm_config'),
        supabase.from('assignments').select('status').eq('reader_id', profile.id),
        supabase.from('reader_feedback').select('id').eq('reader_id', profile.id),
      ]);

      setBalance((balanceRes.data as unknown as ReaderContributionBalance) ?? null);
      setEvents((eventsRes.data as ContributionEvent[]) ?? []);
      setCredits((creditsRes.data as CreditTransaction[]) ?? []);
      setConfig(configRes.data as ContributionAlgorithmVersion | null);

      const assignments = assignRes.data ?? [];
      setStats({
        completed: assignments.filter((a: { status: string }) => a.status === 'completed').length,
        abandoned: assignments.filter((a: { status: string }) => a.status === 'abandoned').length,
        feedback: fbRes.data?.length ?? 0,
        totalPoints: events.reduce((sum, e) => sum + (e as ContributionEvent).points_awarded, 0),
      });

      // Fetch screenplay titles for events
      if (eventsRes.data && eventsRes.data.length > 0) {
        const spIds = [...new Set((eventsRes.data as ContributionEvent[]).map(e => e.screenplay_id))];
        const { data: sps } = await supabase.from('screenplays').select('*').in('id', spIds);
        const spMap: Record<string, Screenplay> = {};
        for (const sp of (sps as Screenplay[]) ?? []) spMap[sp.id] = sp;
        setEvents((eventsRes.data as ContributionEvent[]).map(e => ({ ...e, screenplay: spMap[e.screenplay_id] })));
      }

      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading contribution...</div>;
  }

  const pointsPerCredit = config?.points_per_credit ?? 1000;
  const progressToNextCredit = balance ? (balance.contribution_points / pointsPerCredit) * 100 : 0;
  const completionRate = stats.completed + stats.abandoned > 0
    ? Math.round((stats.completed / (stats.completed + stats.abandoned)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Contribution</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Your contribution points unlock screenplay upload credits.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-ink-100 dark:bg-ink-800 rounded-xl w-fit">
        {(['overview', 'history', 'credits'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-white shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'}`}
          >
            {t === 'credits' ? 'Upload Credits' : t}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <>
          {/* Contribution balance card */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-5 h-5 text-accent-500" />
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Contribution Balance</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Progress to next credit */}
              <div>
                <div className="text-xs font-medium text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">Progress to next upload credit</div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold text-ink-900 dark:text-white tabular-nums">{balance?.contribution_points ?? 0}</span>
                  <span className="text-sm text-ink-400 dark:text-ink-500">/ {pointsPerCredit}</span>
                </div>
                <div className="h-3 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-500"
                    style={{ width: `${Math.min(progressToNextCredit, 100)}%` }}
                  />
                </div>
              </div>

              {/* Credits */}
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs font-medium text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">Available upload credits</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-ink-900 dark:text-white tabular-nums">{balance?.upload_credits ?? 0}</span>
                    <span className="text-sm text-ink-400 dark:text-ink-500">credits</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">Total credits earned</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-ink-900 dark:text-white tabular-nums">{balance?.total_credits_earned ?? 0}</span>
                    <span className="text-sm text-ink-400 dark:text-ink-500">lifetime</span>
                  </div>
                </div>
                {!balance?.free_upload_used && (
                  <div className="flex items-center gap-2 text-sm text-forest-700 dark:text-forest-400 bg-forest-50 dark:bg-forest-900/20 rounded-lg px-3 py-2">
                    <Gift className="w-4 h-4" /> 1 free upload credit available
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Screenplays Read" value={stats.completed} sublabel="completed" accent="forest" />
            <StatCard label="Feedback" value={stats.feedback} sublabel="reviews submitted" accent="accent" />
            <StatCard label="Completion Rate" value={`${completionRate}%`} sublabel="of assignments" accent="sea" />
            <StatCard label="Total Points" value={stats.totalPoints} sublabel="earned lifetime" accent="coral" />
          </div>

          {/* Recent contribution events */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-ink-400" />
                <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Recent Activity</h2>
              </div>
              <button onClick={() => setTab('history')} className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {events.length === 0 ? (
              <div className="text-center py-8 text-sm text-ink-400 dark:text-ink-500">
                No contribution activity yet. Read and review screenplays to earn points.
              </div>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex items-center gap-3 py-2.5 border-b border-ink-50 dark:border-ink-800 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-accent-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 dark:text-white truncate">
                        {event.screenplay?.title ?? 'Screenplay'}
                      </div>
                      <div className="text-xs text-ink-400 dark:text-ink-500 capitalize">
                        {event.source} · {relativeTime(event.created_at)}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-accent-600 dark:text-accent-400 tabular-nums">+{event.points_awarded}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Contribution History</h2>
          {events.length === 0 ? (
            <div className="text-center py-12 text-sm text-ink-400 dark:text-ink-500">
              No contribution events yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="flex items-center gap-4 py-3 border-b border-ink-50 dark:border-ink-800 last:border-0">
                  <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-accent-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 dark:text-white">
                      {event.screenplay?.title ?? 'Screenplay review'}
                    </div>
                    <div className="text-xs text-ink-400 dark:text-ink-500">
                      <span className="capitalize">{event.source}</span> · {relativeTime(event.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-accent-600 dark:text-accent-400 tabular-nums">+{event.points_awarded}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* CREDITS TAB */}
      {tab === 'credits' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-ink-400" />
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Upload Credits</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 rounded-xl bg-ink-50 dark:bg-ink-800">
                <div className="text-2xl font-bold text-ink-900 dark:text-white tabular-nums">{balance?.upload_credits ?? 0}</div>
                <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">Available</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-ink-50 dark:bg-ink-800">
                <div className="text-2xl font-bold text-ink-900 dark:text-white tabular-nums">{balance?.total_credits_earned ?? 0}</div>
                <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">Total Earned</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-ink-50 dark:bg-ink-800">
                <div className="text-2xl font-bold text-ink-900 dark:text-white tabular-nums">{balance?.free_upload_used ? '0' : '1'}</div>
                <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">Free Upload</div>
              </div>
            </div>
            <div className="text-sm text-ink-500 dark:text-ink-400">
              {pointsPerCredit} contribution points = 1 upload credit. Every new account gets 1 free upload.
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Credit Transaction History</h3>
            {credits.length === 0 ? (
              <div className="text-center py-8 text-sm text-ink-400 dark:text-ink-500">No credit transactions yet.</div>
            ) : (
              <div className="space-y-2">
                {credits.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-ink-50 dark:border-ink-800 last:border-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'free' ? 'bg-forest-50 dark:bg-forest-900/20' :
                      tx.type === 'earned' ? 'bg-accent-50 dark:bg-accent-900/20' :
                      'bg-coral-50 dark:bg-coral-900/20'
                    }`}>
                      {tx.type === 'free' ? <Gift className="w-4 h-4 text-forest-500" /> :
                       tx.type === 'earned' ? <TrendingUp className="w-4 h-4 text-accent-500" /> :
                       <Upload className="w-4 h-4 text-coral-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 dark:text-white capitalize">{tx.type} credit</div>
                      <div className="text-xs text-ink-400 dark:text-ink-500">
                        {tx.note ?? relativeTime(tx.created_at)} · {relativeTime(tx.created_at)}
                      </div>
                    </div>
                    <Badge color={tx.type === 'spent' ? 'coral' : 'forest'}>
                      {tx.type === 'spent' ? '-' : '+'}{tx.credits}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
