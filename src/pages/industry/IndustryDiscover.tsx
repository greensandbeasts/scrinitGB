import { useEffect, useState, useMemo } from 'react';
import { Search, Users, TrendingUp, Star, ThumbsUp, BookOpen, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Badge } from '@/components/ui/Card';
import { getCoverColor, relativeTime, type ScreenplayDiscovery } from '@/lib/types';

interface IndustryDiscoverProps {
  navigate: (to: string) => void;
}

type SortKey = 'confidence' | 'completion' | 'rating' | 'recommend' | 'readers' | 'recent';

export function IndustryDiscover({ navigate }: IndustryDiscoverProps) {
  const [screenplays, setScreenplays] = useState<ScreenplayDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('confidence');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('screenplay_discovery')
        .select('*')
        .eq('industry_qualified', true)
        .order('confidence_score', { ascending: false });
      setScreenplays((data as ScreenplayDiscovery[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const genres = useMemo(() => {
    const set = new Set(screenplays.map((s) => s.genre));
    return ['all', ...Array.from(set)];
  }, [screenplays]);

  const filtered = useMemo(() => {
    let result = screenplays;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.logline.toLowerCase().includes(q) ||
        s.writer_name.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q)),
      );
    }
    if (genre !== 'all') {
      result = result.filter((s) => s.genre === genre);
    }
    const sorted = [...result];
    switch (sortBy) {
      case 'confidence': sorted.sort((a, b) => b.confidence_score - a.confidence_score); break;
      case 'completion': sorted.sort((a, b) => b.completion_rate - a.completion_rate); break;
      case 'rating': sorted.sort((a, b) => b.avg_rating - a.avg_rating); break;
      case 'recommend': sorted.sort((a, b) => b.recommend_rate - a.recommend_rate); break;
      case 'readers': sorted.sort((a, b) => b.reader_count - a.reader_count); break;
      case 'recent': sorted.sort((a, b) => new Date(b.published_at ?? '').getTime() - new Date(a.published_at ?? '').getTime()); break;
    }
    return sorted;
  }, [screenplays, search, genre, sortBy]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading discovery feed...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Discover screenplays</h1>
        <p className="text-ink-500 dark:text-ink-400 dark:text-ink-500 mt-1">Screenplays backed by real audience engagement data — not opinions.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 dark:text-ink-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, logline, writer, or tag..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-300 transition-all"
          />
        </div>
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-300 transition-all"
        >
          {genres.map((g) => (
            <option key={g} value={g}>{g === 'all' ? 'All genres' : g}</option>
          ))}
        </select>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 dark:text-ink-500 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="pl-10 pr-8 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-300 transition-all appearance-none"
          >
            <option value="confidence">Confidence score</option>
            <option value="completion">Completion rate</option>
            <option value="rating">Average rating</option>
            <option value="recommend">Recommendation rate</option>
            <option value="readers">Reader count</option>
            <option value="recent">Most recent</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-10 h-10 text-ink-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No qualified screenplays yet</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500">Screenplays appear here once they meet the qualification thresholds. Try adjusting your filters.</p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map((sp) => {
            const colors = getCoverColor(sp.cover_color);
            return (
              <Card key={sp.id} hover className="p-5 cursor-pointer" >
                <div onClick={() => navigate(`/industry/screenplay/${sp.id}`)}>
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-18 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md`}>
                      <BookOpen className="w-5 h-5 text-white/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-ink-900 dark:text-white truncate">{sp.title}</h3>
                        <Badge color="ink">{sp.genre}</Badge>
                      </div>
                      <p className="text-xs text-ink-400 dark:text-ink-500 mb-2">by Anonymous Writer · {sp.page_count} pages</p>
                      <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 line-clamp-2 mb-3">{sp.logline}</p>
                    </div>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="text-2xl font-bold text-ink-900 dark:text-white tabular-nums">{sp.confidence_score}</div>
                      <div className="text-[10px] text-ink-400 dark:text-ink-500 uppercase tracking-wider">Confidence</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-ink-600 dark:text-ink-300">
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-sm font-semibold tabular-nums">{sp.reader_count}</span>
                      </div>
                      <div className="text-[10px] text-ink-400 dark:text-ink-500 mt-0.5">Readers</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-forest-600">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-sm font-semibold tabular-nums">{sp.completion_rate}%</span>
                      </div>
                      <div className="text-[10px] text-ink-400 dark:text-ink-500 mt-0.5">Completion</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-accent-600">
                        <Star className="w-3.5 h-3.5" />
                        <span className="text-sm font-semibold tabular-nums">{sp.avg_rating}</span>
                      </div>
                      <div className="text-[10px] text-ink-400 dark:text-ink-500 mt-0.5">Rating</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-sea-600">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="text-sm font-semibold tabular-nums">{sp.recommend_rate}%</span>
                      </div>
                      <div className="text-[10px] text-ink-400 dark:text-ink-500 mt-0.5">Recommend</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {sp.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs text-ink-400 dark:text-ink-500">#{tag}</span>
                      ))}
                    </div>
                    <span className="text-xs text-ink-400 dark:text-ink-500 flex items-center gap-1">
                      View insights <ArrowRight className="w-3 h-3" />
                    </span>
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
