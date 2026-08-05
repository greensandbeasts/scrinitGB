import { useEffect, useState } from 'react';
import { Clock, BookOpen, CheckCircle, XCircle, BarChart3, FileText, Bell, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getCoverColor, relativeTime, type Assignment, type Screenplay, type ReaderFeedback, type FollowerNotification } from '@/lib/types';

interface ReaderHistoryProps {
  navigate: (to: string) => void;
}

interface HistoryItem extends Assignment {
  screenplay?: Pick<Screenplay, 'id' | 'title' | 'genre' | 'cover_color' | 'page_count' | 'lifecycle_status'>;
}

export function ReaderHistory({ navigate }: ReaderHistoryProps) {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<HistoryItem[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, ReaderFeedback>>({});
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followerNotifications, setFollowerNotifications] = useState<FollowerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const [assignRes, fbRes, followRes, notifRes] = await Promise.all([
        supabase
          .from('assignments')
          .select(`*, screenplay:screenplays(id, title, genre, cover_color, page_count, lifecycle_status)`)
          .eq('reader_id', profile.id)
          .order('assigned_at', { ascending: false }),
        supabase.from('reader_feedback').select('*').eq('reader_id', profile.id),
        supabase.from('screenplay_followers').select('screenplay_id').eq('reader_id', profile.id),
        supabase.from('follower_notifications').select('*').eq('follower_id', profile.id).order('created_at', { ascending: false }).limit(5),
      ]);
      setAssignments((assignRes.data as HistoryItem[]) ?? []);
      const fbMap: Record<string, ReaderFeedback> = {};
      for (const fb of (fbRes.data as ReaderFeedback[]) ?? []) {
        if (fb.assignment_id) fbMap[fb.assignment_id] = fb;
      }
      setFeedbackMap(fbMap);
      setFollowedIds(new Set((followRes.data as { screenplay_id: string }[])?.map((f) => f.screenplay_id) ?? []));
      setFollowerNotifications((notifRes.data as FollowerNotification[]) ?? []);
      setLoading(false);
    }
    load();
  }, [profile]);

  const handleFollow = async (screenplayId: string) => {
    if (!profile) return;
    if (followedIds.has(screenplayId)) {
      await supabase.from('screenplay_followers').delete().eq('screenplay_id', screenplayId).eq('reader_id', profile.id);
      setFollowedIds((prev) => {
        const next = new Set(prev);
        next.delete(screenplayId);
        return next;
      });
    } else {
      await supabase.from('screenplay_followers').insert({ screenplay_id: screenplayId, reader_id: profile.id });
      setFollowedIds((prev) => new Set(prev).add(screenplayId));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-ink-400 animate-pulse">Loading reading history...</div>
      </div>
    );
  }

  const completed = assignments.filter((a) => a.status === 'completed');
  const abandoned = assignments.filter((a) => a.status === 'abandoned');
  const reviewed = assignments.filter((a) => feedbackMap[a.id]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Reading History</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Every screenplay you have been assigned.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2"><BookOpen className="w-3.5 h-3.5" /> Total</div>
          <div className="text-2xl font-bold text-ink-900 dark:text-white">{assignments.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2"><CheckCircle className="w-3.5 h-3.5" /> Completed</div>
          <div className="text-2xl font-bold text-forest-600 dark:text-forest-400">{completed.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2"><FileText className="w-3.5 h-3.5" /> Reviewed</div>
          <div className="text-2xl font-bold text-accent-600 dark:text-accent-400">{reviewed.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2"><XCircle className="w-3.5 h-3.5" /> Abandoned</div>
          <div className="text-2xl font-bold text-coral-600 dark:text-coral-400">{abandoned.length}</div>
        </Card>
      </div>

      {followerNotifications.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-accent-500" />
            <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Screenplay updates</h2>
          </div>
          <div className="space-y-2">
            {followerNotifications.map((n) => (
              <div key={n.id} className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${n.read ? 'bg-ink-300' : 'bg-accent-500'}`} />
                <span className="font-medium text-ink-900 dark:text-white">{n.title}</span>
                <span className="text-ink-400 dark:text-ink-500">{relativeTime(n.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {assignments.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="w-10 h-10 text-ink-300 dark:text-ink-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No reading history yet</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400">Screenplays assigned to you will appear here.</p>
          </Card>
        ) : (
          assignments.map((a) => {
            const colors = getCoverColor(a.screenplay?.cover_color ?? 'amber');
            const hasFeedback = !!feedbackMap[a.id];
            const isFollowed = a.screenplay ? followedIds.has(a.screenplay.id) : false;
            const isArchived = a.screenplay?.lifecycle_status && a.screenplay.lifecycle_status !== 'active';

            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-16 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-sm`}>
                    <BookOpen className="w-4 h-4 text-white/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-ink-900 dark:text-white truncate">{a.screenplay?.title ?? 'Unknown'}</h3>
                      <Badge color={a.status === 'completed' ? 'forest' : a.status === 'abandoned' ? 'coral' : 'ink'}>
                        {a.status}
                      </Badge>
                      {isArchived && <Badge color="slate">Archived</Badge>}
                      {hasFeedback && <Badge color="accent">Reviewed</Badge>}
                    </div>
                    <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">
                      {a.screenplay?.genre} · {a.screenplay?.page_count} pages · Assigned {relativeTime(a.assigned_at)}
                    </div>

                    {hasFeedback && a.screenplay && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/reader/analytics/${a.screenplay!.id}`)}>
                          <BarChart3 className="w-3.5 h-3.5" /> View Analytics
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/reader/review/${a.screenplay!.id}`)}>
                          <FileText className="w-3.5 h-3.5" /> View My Review
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFollow(a.screenplay!.id)}
                          className={isFollowed ? 'text-coral-600' : 'text-ink-500'}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFollowed ? 'fill-coral-500' : ''}`} />
                          {isFollowed ? 'Unfollow' : 'Follow'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
