import { useEffect, useState } from 'react';
import { Plus, BookOpen, Users, TrendingUp, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getCoverColor, relativeTime, type Screenplay, type ScreenplayDiscovery, LIFECYCLE_STATUS_LABELS } from '@/lib/types';

interface WriterScreenplaysProps {
  navigate: (to: string) => void;
}

export function WriterScreenplays({ navigate }: WriterScreenplaysProps) {
  const { profile } = useAuth();
  const [screenplays, setScreenplays] = useState<Screenplay[]>([]);
  const [discoveryMap, setDiscoveryMap] = useState<Record<string, ScreenplayDiscovery>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const [spRes, discRes] = await Promise.all([
        supabase.from('screenplays').select('*').eq('writer_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('screenplay_discovery').select('*').eq('writer_id', profile.id),
      ]);
      setScreenplays((spRes.data as Screenplay[]) ?? []);
      const map: Record<string, ScreenplayDiscovery> = {};
      for (const d of (discRes.data as ScreenplayDiscovery[]) ?? []) {
        map[d.id] = d;
      }
      setDiscoveryMap(map);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading screenplays...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Screenplays</h1>
          <p className="text-ink-500 dark:text-ink-400 dark:text-ink-500 mt-1">Manage all your scripts and their engagement data.</p>
        </div>
        <Button onClick={() => navigate('/writer/upload')}>
          <Plus className="w-4 h-4" />
          New screenplay
        </Button>
      </div>

      {screenplays.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-10 h-10 text-ink-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No screenplays yet</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 mb-6">Upload your first screenplay to get started.</p>
          <Button onClick={() => navigate('/writer/upload')}>
            <Plus className="w-4 h-4" />
            Upload screenplay
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {screenplays.map((sp) => {
            const colors = getCoverColor(sp.cover_color);
            const disc = discoveryMap[sp.id];
            const isDraft = sp.status === 'draft';
            return (
              <Card key={sp.id} hover className="p-5 cursor-pointer" >
                <div onClick={() => navigate(`/writer/screenplay/${sp.id}`)} className="flex items-start gap-4">
                  <div className={`w-14 h-18 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md ${isDraft ? 'opacity-60' : ''}`}>
                    <BookOpen className="w-5 h-5 text-white/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink-900 dark:text-white">{sp.title}</h3>
                      <Badge color={isDraft ? 'slate' : 'forest'}>
                        {isDraft ? 'Draft' : 'Published'}
                      </Badge>
                      <Badge color="ink">{sp.genre}</Badge>
                      {sp.lifecycle_status !== 'active' && (
                        <Badge color="coral">{LIFECYCLE_STATUS_LABELS[sp.lifecycle_status]}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 line-clamp-2 mb-3">{sp.logline}</p>

                    {disc && !isDraft ? (
                      <div className="flex items-center gap-5 text-xs">
                        <span className="flex items-center gap-1.5 text-ink-600 dark:text-ink-300">
                          <Users className="w-3.5 h-3.5" /> {disc.reader_count} readers
                        </span>
                        <span className="flex items-center gap-1.5 text-forest-600">
                          <TrendingUp className="w-3.5 h-3.5" /> {disc.completion_rate}% completed
                        </span>
                        <span className="flex items-center gap-1.5 text-accent-600">
                          <Star className="w-3.5 h-3.5" /> {disc.avg_rating}
                        </span>
                        <span className="text-ink-400 dark:text-ink-500 ml-auto">{relativeTime(sp.published_at ?? sp.created_at)}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-ink-400 dark:text-ink-500">{sp.page_count} pages · Created {relativeTime(sp.created_at)}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
