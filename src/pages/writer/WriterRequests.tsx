import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Mail, Check, X, Clock, ShieldCheck, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getCoverColor, relativeTime, type IndustryRequest, type Screenplay, type Profile } from '@/lib/types';

interface WriterRequestsProps {
  navigate: (to: string) => void;
}

export function WriterRequests({ navigate }: WriterRequestsProps) {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<(IndustryRequest & { screenplay?: Screenplay })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRevealModal, setShowRevealModal] = useState<IndustryRequest | null>(null);
  const [revealPrefs, setRevealPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const { data } = await supabase
        .from('industry_requests')
        .select('*')
        .eq('writer_id', profile.id)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const screenplayIds = [...new Set(data.map((r) => r.screenplay_id))];
        const { data: screenplays } = await supabase
          .from('screenplays')
          .select('*')
          .in('id', screenplayIds);
        const spMap: Record<string, Screenplay> = {};
        for (const sp of (screenplays as Screenplay[]) ?? []) {
          spMap[sp.id] = sp;
        }
        setRequests(data.map((r) => ({ ...r, screenplay: spMap[r.screenplay_id] })));
      }
      setLoading(false);

      // Load identity reveal preferences
      const { data: profData } = await supabase
        .from('profiles')
        .select('identity_reveal_preferences')
        .eq('id', profile.id)
        .maybeSingle();
      if (profData?.identity_reveal_preferences) {
        setRevealPrefs(profData.identity_reveal_preferences as Record<string, boolean>);
      }
    }
    load();
  }, [profile]);

  const handleRespond = async (requestId: string, status: 'approved' | 'declined') => {
    if (status === 'approved') {
      const req = requests.find(r => r.id === requestId);
      if (req) {
        setShowRevealModal(req);
        return;
      }
    }
    await declineRequest(requestId);
  };

  const declineRequest = async (requestId: string) => {
    setActionLoading(requestId);
    await supabase
      .from('industry_requests')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', requestId);
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'declined' } : r));
    setActionLoading(null);

    // Notify industry user
    const req = requests.find(r => r.id === requestId);
    if (req) {
      await supabase.rpc('create_notification', {
        p_user_id: req.industry_user_id,
        p_type: 'introduction_declined',
        p_title: 'Introduction declined',
        p_body: 'The writer has declined your introduction request.',
        p_screenplay_id: req.screenplay_id,
        p_request_id: req.id,
      });
    }
  };

  const handleRevealIdentity = async (selectedFields: Record<string, boolean>) => {
    if (!showRevealModal || !profile) return;
    setActionLoading(showRevealModal.id);
    await supabase
      .from('industry_requests')
      .update({
        status: 'approved',
        responded_at: new Date().toISOString(),
        identity_revealed: true,
        identity_fields_revealed: selectedFields,
      })
      .eq('id', showRevealModal.id);

    // Save updated reveal preferences
    await supabase
      .from('profiles')
      .update({ identity_reveal_preferences: selectedFields })
      .eq('id', profile.id);

    setRevealPrefs(selectedFields);
    setRequests((prev) => prev.map((r) => r.id === showRevealModal.id ? { ...r, status: 'approved', identity_revealed: true, identity_fields_revealed: selectedFields } : r));
    setActionLoading(null);
    setShowRevealModal(null);

    // Notify industry user
    await supabase.rpc('create_notification', {
      p_user_id: showRevealModal.industry_user_id,
      p_type: 'introduction_accepted',
      p_title: 'Introduction accepted!',
      p_body: 'The writer has accepted your introduction request and revealed their identity.',
      p_screenplay_id: showRevealModal.screenplay_id,
      p_request_id: showRevealModal.id,
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading requests...</div>;
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const resolvedRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/writer')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Introduction requests</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Industry professionals requesting to connect with you. No identities are revealed until you approve.</p>
      </div>

      {requests.length === 0 ? (
        <Card className="p-12 text-center">
          <Mail className="w-10 h-10 text-ink-300 dark:text-ink-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No requests yet</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400">When industry professionals discover your screenplays, their introduction requests will appear here.</p>
        </Card>
      ) : (
        <>
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Pending ({pendingRequests.length})</h2>
              {pendingRequests.map((req) => {
                const colors = req.screenplay ? getCoverColor(req.screenplay.cover_color) : getCoverColor('slate');
                return (
                  <Card key={req.id} className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-16 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md`}>
                        <BookOpen className="w-4 h-4 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-ink-900 dark:text-white">{req.screenplay?.title ?? 'Unknown screenplay'}</h3>
                          <Badge color="accent">Pending</Badge>
                        </div>
                        {req.reason_for_contact && (
                          <div className="text-xs text-ink-400 dark:text-ink-500 mb-1 uppercase tracking-wider">{req.reason_for_contact}</div>
                        )}
                        <p className="text-sm text-ink-600 dark:text-ink-300 mb-3 leading-relaxed">{req.message}</p>
                        <div className="flex items-center gap-3 text-xs text-ink-400 dark:text-ink-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {relativeTime(req.created_at)}
                          </span>
                          {req.company_snapshot && <span>· {req.company_snapshot}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button size="sm" onClick={() => handleRespond(req.id, 'approved')} disabled={actionLoading === req.id}>
                          <Check className="w-3.5 h-3.5" /> Accept
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleRespond(req.id, 'declined')} disabled={actionLoading === req.id}>
                          <X className="w-3.5 h-3.5" /> Decline
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {resolvedRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Resolved ({resolvedRequests.length})</h2>
              {resolvedRequests.map((req) => {
                const colors = req.screenplay ? getCoverColor(req.screenplay.cover_color) : getCoverColor('slate');
                return (
                  <Card key={req.id} className={`p-5 ${req.status === 'declined' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-16 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md`}>
                        <BookOpen className="w-4 h-4 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-ink-900 dark:text-white">{req.screenplay?.title ?? 'Unknown screenplay'}</h3>
                          <Badge color={req.status === 'approved' ? 'forest' : 'coral'}>
                            {req.status === 'approved' ? 'Accepted' : 'Declined'}
                          </Badge>
                          {req.identity_revealed && <Badge color="accent">Identity revealed</Badge>}
                        </div>
                        <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-1">{req.message}</p>
                        <div className="text-xs text-ink-400 dark:text-ink-500 mt-2">
                          {req.company_snapshot} · {relativeTime(req.responded_at ?? req.created_at)}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Identity reveal modal */}
      {showRevealModal && (
        <IdentityRevealModal
          request={showRevealModal}
          currentPrefs={revealPrefs}
          onClose={() => setShowRevealModal(null)}
          onConfirm={handleRevealIdentity}
          saving={actionLoading === showRevealModal.id}
        />
      )}
    </div>
  );
}

function IdentityRevealModal({
  request,
  currentPrefs,
  onClose,
  onConfirm,
  saving,
}: {
  request: IndustryRequest;
  currentPrefs: Record<string, boolean>;
  onClose: () => void;
  onConfirm: (fields: Record<string, boolean>) => void;
  saving: boolean;
}) {
  const [fields, setFields] = useState<Record<string, boolean>>(currentPrefs);

  const fieldOptions = [
    { key: 'name', label: 'Name' },
    { key: 'biography', label: 'Biography' },
    { key: 'website', label: 'Website' },
    { key: 'imdb', label: 'IMDb' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'agent', label: 'Agent / Representative' },
    { key: 'contact_through_scrinit', label: 'Contact through Scrinit only' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={onClose}>
      <Card className="p-6 max-w-md w-full animate-scale-in">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-forest-50 dark:bg-forest-900/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-forest-600 dark:text-forest-400" />
            </div>
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white">Reveal your identity</h3>
              <p className="text-xs text-ink-400 dark:text-ink-500">Choose what information to share</p>
            </div>
          </div>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
            You're accepting an introduction request for <span className="font-medium text-ink-700 dark:text-ink-200">{request.message.slice(0, 40)}...</span>.
            Select which profile fields to reveal to the industry professional.
          </p>
          <div className="space-y-2 mb-6">
            {fieldOptions.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 p-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={fields[key] ?? false}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.checked })}
                  className="w-4 h-4 rounded accent-ink-900 dark:accent-white"
                />
                <span className="text-sm text-ink-700 dark:text-ink-300">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onConfirm(fields)} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Accept & reveal'}
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
