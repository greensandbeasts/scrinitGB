import { useEffect, useState, useMemo } from 'react';
import { Search, Shield, Ban, CheckCircle2, UserCog, X, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Badge } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { relativeTime, type Profile, type UserRole } from '@/lib/types';

export function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  }

  const showMsg = (type: 'success' | 'error', text: string) => {
    if (type === 'success') { setSuccess(text); setError(null); } else { setError(text); setSuccess(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 4000);
  };

  const changeRole = async (userId: string, newRole: UserRole) => {
    setActionLoading(true);
    const { error } = await supabase.from('profiles').update({ role: newRole, updated_at: new Date().toISOString() }).eq('id', userId);
    setActionLoading(false);
    if (error) { showMsg('error', error.message); return; }
    setProfiles(profiles.map(p => p.id === userId ? { ...p, role: newRole } : p));
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, role: newRole });
    showMsg('success', `Role changed to ${newRole}`);
  };

  const toggleSuspend = async (user: Profile) => {
    setActionLoading(true);
    const newSuspended = !user.suspended;
    const updates: Record<string, unknown> = {
      suspended: newSuspended,
      updated_at: new Date().toISOString(),
    };
    if (newSuspended) {
      updates.suspended_at = new Date().toISOString();
      updates.suspended_reason = 'Suspended by administrator';
    } else {
      updates.suspended_at = null;
      updates.suspended_reason = null;
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    setActionLoading(false);
    if (error) { showMsg('error', error.message); return; }
    setProfiles(profiles.map(p => p.id === user.id ? { ...p, ...updates } as Profile : p));
    if (selectedUser?.id === user.id) setSelectedUser({ ...selectedUser, ...updates } as Profile);
    showMsg('success', newSuspended ? 'User suspended' : 'User reinstated');
  };

  const filtered = useMemo(() => {
    let result = profiles;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.display_name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') {
      result = result.filter((p) => p.role === roleFilter);
    }
    return result;
  }, [profiles, search, roleFilter]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading users...</div>;
  }

  const roleBadgeColor = {
    writer: 'accent' as const,
    reader: 'sea' as const,
    industry: 'forest' as const,
    admin: 'slate' as const,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Users</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Manage and moderate all platform users.</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 text-forest-700 dark:text-forest-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 dark:text-ink-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-300 transition-all"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          className="px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-300 transition-all"
        >
          <option value="all">All roles</option>
          <option value="writer">Writers</option>
          <option value="reader">Readers</option>
          <option value="industry">Industry</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <Card className="p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-ink-500 dark:text-ink-400">No users found.</div>
        ) : (
          <div className="space-y-1">
            <div className="hidden md:grid grid-cols-12 gap-4 px-3 py-2 text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
              <div className="col-span-4">User</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            {filtered.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-4 px-3 py-3 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-900 transition-colors items-center">
                <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                  <Avatar name={p.display_name} color={p.avatar_color} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{p.display_name}</div>
                    <div className="text-xs text-ink-400 dark:text-ink-500">{p.company ?? '—'}</div>
                  </div>
                </div>
                <div className="col-span-6 md:col-span-3 text-sm text-ink-500 dark:text-ink-400 truncate">{p.email}</div>
                <div className="col-span-3 md:col-span-2">
                  <Badge color={roleBadgeColor[p.role]}>{p.role}</Badge>
                </div>
                <div className="col-span-3 md:col-span-2">
                  {p.suspended ? (
                    <Badge color="coral"><Ban className="w-3 h-3 mr-1" />Suspended</Badge>
                  ) : (
                    <Badge color="forest"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
                  )}
                </div>
                <div className="col-span-12 md:col-span-1 flex md:justify-end">
                  <button
                    onClick={() => setSelectedUser(p)}
                    className="p-2 rounded-lg text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-ink-800 transition-all"
                    title="Manage user"
                  >
                    <UserCog className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* User management modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={() => setSelectedUser(null)}>
          <Card className="max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedUser.display_name} color={selectedUser.avatar_color} size="lg" />
                  <div>
                    <h2 className="text-lg font-bold text-ink-900 dark:text-white">{selectedUser.display_name}</h2>
                    <p className="text-sm text-ink-400 dark:text-ink-500">{selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-ink-800 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User details */}
              <div className="space-y-3 mb-6">
                <DetailRow label="Role" value={<Badge color={roleBadgeColor[selectedUser.role]}>{selectedUser.role}</Badge>} />
                <DetailRow label="Company" value={selectedUser.company ?? '—'} />
                <DetailRow label="Country" value={selectedUser.country ?? '—'} />
                <DetailRow label="Joined" value={relativeTime(selectedUser.created_at)} />
                <DetailRow label="Status" value={
                  selectedUser.suspended
                    ? <Badge color="coral"><Ban className="w-3 h-3 mr-1" />Suspended</Badge>
                    : <Badge color="forest"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
                } />
                {selectedUser.bio && <DetailRow label="Bio" value={selectedUser.bio} />}
              </div>

              {/* Role change */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">Change role</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['writer', 'reader', 'industry', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => changeRole(selectedUser.id, r)}
                      disabled={actionLoading || selectedUser.role === r}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                        selectedUser.role === r
                          ? 'border-ink-300 dark:border-ink-600 bg-ink-100 dark:bg-ink-800 text-ink-900 dark:text-white'
                          : 'border-ink-100 dark:border-ink-800 text-ink-500 dark:text-ink-400 hover:border-ink-200 dark:hover:border-ink-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suspend / reinstate */}
              <div className="pt-4 border-t border-ink-100 dark:border-ink-800">
                <Button
                  variant={selectedUser.suspended ? 'secondary' : 'danger'}
                  onClick={() => toggleSuspend(selectedUser)}
                  disabled={actionLoading}
                  className="w-full"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    selectedUser.suspended ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  {selectedUser.suspended ? 'Reinstate user' : 'Suspend user'}
                </Button>
                {selectedUser.suspended && (
                  <p className="text-xs text-ink-400 dark:text-ink-500 mt-2 text-center">
                    Suspended {selectedUser.suspended_at ? relativeTime(selectedUser.suspended_at) : ''} · {selectedUser.suspended_reason ?? 'No reason given'}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-400 dark:text-ink-500">{label}</span>
      <span className="text-ink-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}
