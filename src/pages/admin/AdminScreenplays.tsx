import { useEffect, useState, useMemo } from 'react';
import { Search, BookOpen, Users, TrendingUp, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getCoverColor, relativeTime, type ScreenplayDiscovery } from '@/lib/types';

interface AdminScreenplaysProps {
  navigate: (to: string) => void;
}

type SortKey = 'readers' | 'completion' | 'rating' | 'recent';

export function AdminScreenplays({ navigate }: AdminScreenplaysProps) {
  const [screenplays, setScreenplays] = useState<ScreenplayDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('readers');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('screenplay_discovery').select('*');
      setScreenplays((data as ScreenplayDiscovery[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = screenplays;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.title.toLowerCase().includes(q) || s.writer_name.toLowerCase().includes(q));
    }
    const sorted = [...result];
    switch (sortBy) {
      case 'readers': sorted.sort((a, b) => b.reader_count - a.reader_count); break;
      case 'completion': sorted.sort((a, b) => b.completion_rate - a.completion_rate); break;
      case 'rating': sorted.sort((a, b) => b.avg_rating - a.avg_rating); break;
      case 'recent': sorted.sort((a, b) => new Date(b.published_at ?? '').getTime() - new Date(a.published_at ?? '').getTime()); break;
    }
    return sorted;
  }, [screenplays, search, sortBy]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading screenplays...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Screenplays</h1>
        <p className="text-ink-500 dark:text-ink-400 dark:text-ink-500 mt-1">All published screenplays on the platform.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 dark:text-ink-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or writer..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-300 transition-all"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-300 transition-all"
        >
          <option value="readers">Most readers</option>
          <option value="completion">Highest completion</option>
          <option value="rating">Highest rated</option>
          <option value="recent">Most recent</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-10 h-10 text-ink-300 mx-auto mb-4" />
          <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500">No screenplays found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((sp) => {
            const colors = getCoverColor(sp.cover_color);
            return (
              <Card key={sp.id} hover className="p-5 cursor-pointer" >
                <div onClick={() => navigate(`/admin/screenplay/${sp.id}`)} className="flex items-start gap-4">
                  <div className={`w-12 h-16 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md`}>
                    <BookOpen className="w-4 h-4 text-white/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink-900 dark:text-white truncate">{sp.title}</h3>
                      <Badge color="ink">{sp.genre}</Badge>
                    </div>
                    <p className="text-xs text-ink-400 dark:text-ink-500 mb-2">by {sp.writer_name}{sp.writer_company ? ` · ${sp.writer_company}` : ''}</p>
                    <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 line-clamp-1">{sp.logline}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-5 text-xs flex-shrink-0">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-ink-600 dark:text-ink-300"><Users className="w-3.5 h-3.5" /><span className="font-semibold tabular-nums">{sp.reader_count}</span></div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-forest-600"><TrendingUp className="w-3.5 h-3.5" /><span className="font-semibold tabular-nums">{sp.completion_rate}%</span></div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-accent-600"><Star className="w-3.5 h-3.5" /><span className="font-semibold tabular-nums">{sp.avg_rating}</span></div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-ink-900 dark:text-white tabular-nums">{sp.confidence_score}</div>
                      <div className="text-[10px] text-ink-400 dark:text-ink-500 uppercase tracking-wider">Confidence</div>
                    </div>
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
