import { useEffect, useState } from 'react';
import { Bell, Check, Mail, BookOpen, UserCheck, UserX, Clock, CheckCircle, Film } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { relativeTime, type Notification, type FollowerNotification } from '@/lib/types';

interface NotificationsPageProps {
  navigate: (to: string) => void;
}

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  introduction_request: Mail,
  introduction_accepted: UserCheck,
  introduction_declined: UserX,
  reading_access_requested: Clock,
  reading_access_approved: CheckCircle,
  industry_started_reading: BookOpen,
  industry_completed_reading: BookOpen,
  mature_dataset: BookOpen,
};

const NOTIFICATION_COLORS: Record<string, 'accent' | 'forest' | 'coral' | 'ink'> = {
  introduction_request: 'accent',
  introduction_accepted: 'forest',
  introduction_declined: 'coral',
  reading_access_requested: 'accent',
  reading_access_approved: 'forest',
  industry_started_reading: 'ink',
  industry_completed_reading: 'ink',
  mature_dataset: 'accent',
};

const FOLLOWER_NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  optioned: Film,
  purchased: Film,
  in_development: Film,
  in_production: Film,
  available_to_watch: Film,
};

export function NotificationsPage({ navigate }: NotificationsPageProps) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followerNotifs, setFollowerNotifs] = useState<FollowerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const [notifRes, followerRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('follower_notifications')
          .select('*')
          .eq('follower_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setNotifications((notifRes.data as Notification[]) ?? []);
      setFollowerNotifs((followerRes.data as FollowerNotification[]) ?? []);
      setLoading(false);
    }
    load();
  }, [profile]);

  const handleMarkRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkFollowerRead = async (id: string) => {
    await supabase.from('follower_notifications').update({ read: true }).eq('id', id);
    setFollowerNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    if (!profile) return;
    await Promise.all([
      supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false),
      supabase.from('follower_notifications').update({ read: true }).eq('follower_id', profile.id).eq('read', false),
    ]);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setFollowerNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading notifications...</div>;
  }

  const unreadCount = notifications.filter(n => !n.read).length + followerNotifs.filter(n => !n.read).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Notifications</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
            <Check className="w-3.5 h-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-7 h-7 text-ink-300 dark:text-ink-600" />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No notifications yet</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 max-w-md mx-auto">
            When you receive introduction requests, reading access updates, or platform notifications, they will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
            const color = NOTIFICATION_COLORS[n.type] ?? 'ink';
            return (
              <Card
                key={n.id}
                className={`p-4 ${n.read ? '' : 'border-l-4 border-l-accent-400'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    color === 'accent' ? 'bg-accent-50 dark:bg-accent-900/20' :
                    color === 'forest' ? 'bg-forest-50 dark:bg-forest-900/20' :
                    color === 'coral' ? 'bg-coral-50 dark:bg-coral-900/20' :
                    'bg-ink-100 dark:bg-ink-800'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      color === 'accent' ? 'text-accent-600 dark:text-accent-400' :
                      color === 'forest' ? 'text-forest-600 dark:text-forest-400' :
                      color === 'coral' ? 'text-coral-600 dark:text-coral-400' :
                      'text-ink-500 dark:text-ink-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink-900 dark:text-white">{n.title}</span>
                      {!n.read && <Badge color="accent">New</Badge>}
                    </div>
                    {n.body && <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{n.body}</p>}
                    <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">{relativeTime(n.created_at)}</div>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="text-xs text-ink-400 dark:text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors flex-shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
          {followerNotifs.map(n => {
            const Icon = FOLLOWER_NOTIFICATION_ICONS[n.lifecycle_status] ?? Bell;
            return (
              <Card
                key={n.id}
                className={`p-4 ${n.read ? '' : 'border-l-4 border-l-sea-400'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-sea-50 dark:bg-sea-900/20">
                    <Icon className="w-5 h-5 text-sea-600 dark:text-sea-400" />
                  </div>
                  <div className="flex-1 min-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink-900 dark:text-white">{n.title}</span>
                      {!n.read && <Badge color="sea">New</Badge>}
                    </div>
                    {n.body && <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{n.body}</p>}
                    <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">{relativeTime(n.created_at)}</div>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => handleMarkFollowerRead(n.id)}
                      className="text-xs text-ink-400 dark:text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors flex-shrink-0"
                    >
                      Mark read
                    </button>
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
