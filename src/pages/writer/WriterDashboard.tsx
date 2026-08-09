import { useEffect, useState } from 'react';
import { Plus, TrendingUp, Users, BookOpen, Star, ArrowRight, Eye, ThumbsUp, Mail, Building2, Film } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getCoverColor, relativeTime, type Screenplay, type ScreenplayDiscovery, type IndustryRequest } from '@/lib/types';

interface WriterDashboardProps {
  navigate: (to: string) => void;
}

export function WriterDashboard({ navigate }: WriterDashboardProps) {
  const { profile } = useAuth();
  const [screenplays, setScreenplays] = useState<Screenplay[]>([]);
  const [discovery, setDiscovery] = useState<ScreenplayDiscovery[]>([]);
  const [industryRequests, setIndustryRequests] = useState<IndustryRequest[]>([]);
  const [industryReads, setIndustryReads] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const [spRes, discRes, reqRes, indSessRes] = await Promise.all([
        supabase.from('screenplays').select('*').eq('writer_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('screenplay_discovery').select('*').eq('writer_id', profile.id).order('reader_count', { ascending: false }),
        supabase.from('industry_requests').select('*').eq('writer_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('industry_reading_sessions').select('id').in('screenplay_id', (await supabase.from('screenplays').select('id').eq('writer_id', profile.id)).data?.map(s => s.id) ?? []),
      ]);
      setScreenplays((spRes.data as Screenplay[]) ?? []);
      setDiscovery((discRes.data as ScreenplayDiscovery[]) ?? []);
      setIndustryRequests((reqRes.data as IndustryRequest[]) ?? []);
      setIndustryReads(indSessRes.data?.length ?? 0);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading your dashboard...</div>
      </div>
    );
  }

  const publishedScreenplays = screenplays.filter((s) => s.status === 'published');
  const draftScreenplays = screenplays.filter((s) => s.status === 'draft');
  const totalReaders = discovery.reduce((sum, d) => sum + d.reader_count, 0);
  const totalCompleted = discovery.reduce((sum, d) => sum + d.completed_count, 0);
  const totalFeedback = discovery.reduce((sum, d) => sum + d.feedback_count, 0);
  const avgRating = discovery.length > 0
    ? (discovery.reduce((sum, d) => sum + d.avg_rating, 0) / discovery.length).toFixed(1)
    : '—';
  const acceptedIntros = industryRequests.filter(r => r.status === 'approved').length;
  const declinedIntros = industryRequests.filter(r => r.status === 'declined').length;
  const pendingIntros = industryRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Welcome, {profile?.display_name.split(' ')[0]}</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">Your screenplay engagement at a glance.</p>
        </div>
        <Button onClick={() => navigate('/writer/upload')}>
          <Plus className="w-4 h-4" />
          New screenplay
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Published" value={publishedScreenplays.length} sublabel={`${draftScreenplays.length} drafts`} accent="ink" />
        <StatCard label="Total readers" value={totalReaders} sublabel="independent readers" accent="sea" />
        <StatCard label="Completions" value={totalCompleted} sublabel="readers who finished" accent="forest" />
        <StatCard label="Avg rating" value={avgRating} sublabel={`${totalFeedback} reviews`} accent="accent" />
      </div>

      {/* Industry stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Industry reads" value={industryReads} sublabel="total reading sessions" accent="sea" />
        <StatCard label="Intro requests" value={industryRequests.length} sublabel={`${pendingIntros} pending`} accent="accent" />
        <StatCard label="Accepted" value={acceptedIntros} sublabel="introductions revealed" accent="forest" />
        <StatCard label="Declined" value={declinedIntros} sublabel="requests declined" accent="coral" />
      </div>

      {/* Screenplay performance */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink-900 dark:text-white">Screenplay performance</h2>
          <button onClick={() => navigate('/writer/screenplays')} className="text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {discovery.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-ink-300 dark:text-ink-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No published screenplays yet</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-6 max-w-md mx-auto">Upload your first screenplay and publish it to start collecting audience engagement data.</p>
            <Button onClick={() => navigate('/writer/upload')}>
              <Plus className="w-4 h-4" />
              Upload screenplay
            </Button>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {discovery.map((sp) => {
              const colors = getCoverColor(sp.cover_color);
              return (
                <Card key={sp.id} hover className="p-5 cursor-pointer" >
                  <div onClick={() => navigate(`/writer/screenplay/${sp.id}`)}>
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-18 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md`}>
                        <BookOpen className="w-5 h-5 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-ink-900 dark:text-white truncate">{sp.title}</h3>
                          <Badge color="ink">{sp.genre}</Badge>
                        </div>
                        <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-2 mb-3">{sp.logline}</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1 text-ink-600">
                            <Users className="w-3.5 h-3.5" /> {sp.reader_count} readers
                          </span>
                          <span className="flex items-center gap-1 text-forest-600">
                            <TrendingUp className="w-3.5 h-3.5" /> {sp.completion_rate}% completed
                          </span>
                          <span className="flex items-center gap-1 text-accent-600">
                            <Star className="w-3.5 h-3.5" /> {sp.avg_rating}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800 flex items-center justify-between text-xs text-ink-400 dark:text-ink-500">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3.5 h-3.5" /> {sp.recommend_rate}% recommend
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> {sp.return_rate}% return rate
                      </span>
                      <span>Published {relativeTime(sp.published_at ?? '')}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Drafts */}
      {draftScreenplays.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-ink-900 dark:text-white mb-4">Drafts</h2>
          <div className="grid lg:grid-cols-2 gap-4">
            {draftScreenplays.map((sp) => {
              const colors = getCoverColor(sp.cover_color);
              return (
                <Card key={sp.id} hover className="p-5 cursor-pointer" >
                  <div onClick={() => navigate(`/writer/screenplay/${sp.id}`)}>
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-18 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md opacity-60`}>
                        <BookOpen className="w-5 h-5 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-ink-900 dark:text-white truncate">{sp.title}</h3>
                          <Badge color="slate">Draft</Badge>
                        </div>
                        <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-2">{sp.logline}</p>
                        <p className="text-xs text-ink-400 dark:text-ink-500 mt-2">{sp.page_count} pages · {sp.genre}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
