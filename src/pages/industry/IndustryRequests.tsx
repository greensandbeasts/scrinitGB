import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Clock, Check, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getCoverColor, relativeTime, type IndustryRequest, type ScreenplayDiscovery } from '@/lib/types';

interface IndustryRequestsProps {
  navigate: (to: string) => void;
}

export function IndustryRequests({ navigate }: IndustryRequestsProps) {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<(IndustryRequest & { discovery?: ScreenplayDiscovery })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const { data } = await supabase
        .from('industry_requests')
        .select('*')
        .eq('industry_user_id', profile.id)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const screenplayIds = [...new Set(data.map((r) => r.screenplay_id))];
        const { data: discovery } = await supabase
          .from('screenplay_discovery')
          .select('*')
          .in('id', screenplayIds);
        const discMap: Record<string, ScreenplayDiscovery> = {};
        for (const d of (discovery as ScreenplayDiscovery[]) ?? []) {
          discMap[d.id] = d;
        }
        setRequests(data.map((r) => ({ ...r, discovery: discMap[r.screenplay_id] })));
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading requests...</div>;
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/industry')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 hover:text-ink-900 dark:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to discovery
      </button>

      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">My requests</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Track your introduction requests and their status.</p>
      </div>

      {requests.length === 0 ? (
        <Card className="p-12 text-center">
          <Mail className="w-10 h-10 text-ink-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No requests yet</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">Discover screenplays and request introductions to the writers.</p>
          <Button onClick={() => navigate('/industry')}>Browse screenplays</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const colors = req.discovery ? getCoverColor(req.discovery.cover_color) : getCoverColor('slate');
            const statusBadge = {
              pending: { color: 'accent' as const, icon: Clock, label: 'Pending' },
              approved: { color: 'forest' as const, icon: Check, label: 'Approved' },
              declined: { color: 'coral' as const, icon: AlertCircle, label: 'Declined' },
              withdrawn: { color: 'slate' as const, icon: AlertCircle, label: 'Withdrawn' },
            }[req.status];

            return (
              <Card key={req.id} hover={!!req.discovery} className="p-5">
                <div
                  className={`flex items-start gap-4 ${req.discovery ? 'cursor-pointer' : ''}`}
                  onClick={() => req.discovery && navigate(`/industry/screenplay/${req.screenplay_id}`)}
                >
                  <div className={`w-12 h-16 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md`}>
                    <BookOpen className="w-4 h-4 text-white/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink-900 dark:text-white">{req.discovery?.title ?? 'Unknown screenplay'}</h3>
                      <Badge color={statusBadge.color}>
                        <statusBadge.icon className="w-3 h-3 mr-1" />
                        {statusBadge.label}
                      </Badge>
                    </div>
                    {req.discovery && (
                      <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 line-clamp-1 mb-2">{req.discovery.logline}</p>
                    )}
                    <p className="text-xs text-ink-400 dark:text-ink-500">
                      Requested {relativeTime(req.created_at)}
                      {req.responded_at && ` · Responded ${relativeTime(req.responded_at)}`}
                    </p>
                    {req.identity_revealed && (
                      <Badge color="forest">Identity revealed</Badge>
                    )}
                    {req.reason_for_contact && (
                      <p className="text-xs text-ink-400 dark:text-ink-500 mt-2 uppercase tracking-wider">{req.reason_for_contact}</p>
                    )}
                  </div>
                  {req.discovery && (
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="text-xl font-bold text-ink-900 dark:text-white tabular-nums">{req.discovery.confidence_score}</div>
                      <div className="text-[10px] text-ink-400 dark:text-ink-500 uppercase tracking-wider">Confidence</div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
