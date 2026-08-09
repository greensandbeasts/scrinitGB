import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Card';
import { SELECTABLE_ROLE_LABELS } from '@/lib/types';

interface ProfilePageProps {
  navigate: (to: string) => void;
}

export function ProfilePage({ navigate: _navigate }: ProfilePageProps) {
  const { profile, userRoles, activeRole } = useAuth();

  if (!profile) return null;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Profile</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Your public identity across all roles.</p>
      </div>

      <Card className="p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <Avatar name={profile.display_name} color={profile.avatar_color} size="lg" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-ink-900 dark:text-white">{profile.display_name}</h2>
            <p className="text-sm text-ink-400 dark:text-ink-500 mt-0.5">{profile.email}</p>
            {profile.bio && (
              <p className="text-sm text-ink-600 dark:text-ink-300 mt-4 leading-relaxed">{profile.bio}</p>
            )}
            {profile.country && (
              <p className="text-xs text-ink-400 dark:text-ink-500 mt-3">{profile.country}</p>
            )}
            <div className="flex items-center gap-2 mt-4">
              {userRoles.map((role) => (
                <Badge key={role} color={role === activeRole ? 'accent' : 'ink'}>
                  {SELECTABLE_ROLE_LABELS[role]}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Roles</h3>
        <div className="space-y-3">
          {userRoles.map((role) => (
            <div key={role} className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800 last:border-0">
              <div>
                <div className="text-sm font-medium text-ink-900 dark:text-ink-100">{SELECTABLE_ROLE_LABELS[role]}</div>
                <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                  {role === activeRole ? 'Currently active' : 'Enabled'}
                </div>
              </div>
              {role === activeRole && (
                <span className="w-2 h-2 rounded-full bg-accent-500" />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => _navigate(`/${activeRole}/settings`)}
          className="mt-4 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors"
        >
          Manage roles in settings →
        </button>
      </Card>
    </div>
  );
}
