import { useState, useEffect } from 'react';
import { ListChecks, Plus, X, Bookmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getCoverColor, type ScreenplayDiscovery } from '@/lib/types';

interface IndustryWatchlistsProps {
  navigate: (to: string) => void;
}

interface Watchlist {
  id: string;
  name: string;
  screenplay_ids: string[];
}

export function IndustryWatchlists({ navigate }: IndustryWatchlistsProps) {
  const { profile } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [allScreenplays, setAllScreenplays] = useState<Map<string, ScreenplayDiscovery>>(new Map());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const [wlRes, spRes] = await Promise.all([
        supabase.from('industry_profiles').select('watchlists').eq('user_id', profile.id).maybeSingle(),
        supabase.from('screenplay_discovery').select('*'),
      ]);
      const wlData = (wlRes.data?.watchlists ?? []) as Watchlist[];
      setWatchlists(wlData);
      const spMap = new Map<string, ScreenplayDiscovery>();
      (spRes.data as ScreenplayDiscovery[] ?? []).forEach(sp => spMap.set(sp.id, sp));
      setAllScreenplays(spMap);
      setLoading(false);
    }
    load();
  }, [profile]);

  const saveWatchlists = async (updated: Watchlist[]) => {
    if (!profile) return;
    setWatchlists(updated);
    await supabase
      .from('industry_profiles')
      .update({ watchlists: updated as unknown })
      .eq('user_id', profile.id);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const newWl: Watchlist = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      screenplay_ids: [],
    };
    await saveWatchlists([...watchlists, newWl]);
    setNewName('');
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    await saveWatchlists(watchlists.filter(w => w.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-ink-400 animate-pulse">Loading watchlists...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Watchlists</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">Track screenplays you are interested in.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" />
          New watchlist
        </Button>
      </div>

      {creating && (
        <Card className="p-4 flex items-center gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Watchlist name"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 px-4 py-2 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600"
            autoFocus
          />
          <Button size="sm" onClick={handleCreate}>Create</Button>
          <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName(''); }}>
            <X className="w-4 h-4" />
          </Button>
        </Card>
      )}

      {watchlists.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-4">
            <ListChecks className="w-7 h-7 text-ink-300 dark:text-ink-600" />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No watchlists yet</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 max-w-md mx-auto mb-6">
            Create a watchlist to group screenplays you want to keep an eye on. Perfect for tracking multiple projects.
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            Create your first watchlist
          </Button>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {watchlists.map(wl => (
            <Card key={wl.id} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-ink-400" />
                  <h3 className="font-semibold text-ink-900 dark:text-white">{wl.name}</h3>
                  <Badge color="ink">{wl.screenplay_ids.length}</Badge>
                </div>
                <button onClick={() => handleDelete(wl.id)} className="text-ink-400 hover:text-coral-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {wl.screenplay_ids.length === 0 ? (
                <p className="text-sm text-ink-400 dark:text-ink-500 py-4 text-center">No screenplays in this list yet.</p>
              ) : (
                <div className="space-y-2">
                  {wl.screenplay_ids.slice(0, 5).map(sid => {
                    const sp = allScreenplays.get(sid);
                    if (!sp) return null;
                    const colors = getCoverColor(sp.cover_color);
                    return (
                      <div
                        key={sid}
                        onClick={() => navigate(`/industry/screenplay/${sid}`)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer transition-colors"
                      >
                        <div className={`w-8 h-10 rounded bg-gradient-to-br ${colors.gradient} flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{sp.title}</div>
                          <div className="text-xs text-ink-400 dark:text-ink-500">{sp.genre} · {sp.reader_count} readers</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
