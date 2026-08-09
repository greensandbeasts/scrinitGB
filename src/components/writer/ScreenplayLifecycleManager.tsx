import { useState } from 'react';
import {
  Film, Check, AlertCircle, Loader2, Archive, TrendingUp, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  type Screenplay, type LifecycleStatus,
  LIFECYCLE_STATUS_LABELS, LIFECYCLE_STATUS_DESCRIPTIONS, ARCHIVING_STATUSES,
} from '@/lib/types';

interface ScreenplayLifecycleManagerProps {
  screenplay: Screenplay;
  onUpdated: () => void;
}

const STATUS_OPTIONS: { value: LifecycleStatus; icon: typeof Film }[] = [
  { value: 'optioned', icon: Film },
  { value: 'purchased', icon: Film },
  { value: 'in_development', icon: TrendingUp },
  { value: 'in_production', icon: TrendingUp },
  { value: 'available_to_watch', icon: Film },
];

export function ScreenplayLifecycleManager({ screenplay, onUpdated }: ScreenplayLifecycleManagerProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LifecycleStatus | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [streamingPlatform, setStreamingPlatform] = useState('');
  const [tvBroadcaster, setTvBroadcaster] = useState('');
  const [cinemaRelease, setCinemaRelease] = useState('');
  const [officialWebsite, setOfficialWebsite] = useState('');
  const [trailerLink, setTrailerLink] = useState('');
  const [releaseDate, setReleaseDate] = useState('');

  const isArchived = screenplay.lifecycle_status !== 'active';

  const handleSelectStatus = (status: LifecycleStatus) => {
    setSelectedStatus(status);
    setError(null);
    if (status === 'available_to_watch') {
      setShowReleaseForm(true);
    } else {
      setShowReleaseForm(false);
      setShowConfirm(true);
    }
  };

  const handleConfirm = async () => {
    if (!selectedStatus) return;
    setSubmitting(true);
    setError(null);

    const releaseInfo = selectedStatus === 'available_to_watch' ? {
      streaming_platform: streamingPlatform || null,
      tv_broadcaster: tvBroadcaster || null,
      cinema_release: cinemaRelease || null,
      official_website: officialWebsite || null,
      trailer_link: trailerLink || null,
      release_date: releaseDate || null,
    } : null;

    const { error: rpcError } = await supabase.rpc('update_screenplay_lifecycle', {
      p_screenplay_id: screenplay.id,
      p_new_status: selectedStatus,
      p_archive_reason: archiveReason || null,
      p_release_info: releaseInfo,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setShowConfirm(false);
    setShowReleaseForm(false);
    setSelectedStatus(null);
    setArchiveReason('');
    setStreamingPlatform('');
    setTvBroadcaster('');
    setCinemaRelease('');
    setOfficialWebsite('');
    setTrailerLink('');
    setReleaseDate('');
    onUpdated();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Archive className="w-5 h-5 text-ink-400 dark:text-ink-500" />
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Project lifecycle</h2>
      </div>
      <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
        Update the status of your screenplay. Selecting a status below will archive it and remove it from reader assignments and industry discovery.
      </p>

      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm text-ink-500 dark:text-ink-400">Current status:</span>
        <Badge color={isArchived ? 'slate' : 'forest'}>
          {LIFECYCLE_STATUS_LABELS[screenplay.lifecycle_status]}
        </Badge>
        {screenplay.archive_date && (
          <span className="text-xs text-ink-400 dark:text-ink-500">
            Archived {new Date(screenplay.archive_date).toLocaleDateString()}
          </span>
        )}
      </div>

      {isArchived ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-ink-50 dark:bg-ink-800 text-sm text-ink-600 dark:text-ink-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-ink-900 dark:text-white mb-1">
              {LIFECYCLE_STATUS_LABELS[screenplay.lifecycle_status]}
            </p>
            <p className="text-xs">{LIFECYCLE_STATUS_DESCRIPTIONS[screenplay.lifecycle_status]}</p>
            <p className="text-xs mt-2 text-ink-400 dark:text-ink-500">
              This screenplay has been archived. Analytics, feedback, and engagement history are preserved. Readers who completed a review can still view analytics.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">Update to:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelectStatus(opt.value)}
                disabled={submitting}
                className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-ink-200 dark:hover:border-ink-700 transition-all text-left disabled:opacity-50"
              >
                <opt.icon className="w-4 h-4 text-ink-400 dark:text-ink-500" />
                <div>
                  <div className="text-sm font-medium text-ink-900 dark:text-white">{LIFECYCLE_STATUS_LABELS[opt.value]}</div>
                  <div className="text-xs text-ink-400 dark:text-ink-500">{LIFECYCLE_STATUS_DESCRIPTIONS[opt.value]}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {showReleaseForm && selectedStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={() => setShowReleaseForm(false)}>
          <Card className="p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">Release information</h3>
                  <p className="text-xs text-ink-400 dark:text-ink-500">Optional — provide where audiences can watch it</p>
                </div>
                <button onClick={() => setShowReleaseForm(false)} className="p-1 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800">
                  <X className="w-4 h-4 text-ink-400" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <ReleaseField label="Streaming platform" value={streamingPlatform} onChange={setStreamingPlatform} placeholder="e.g. Netflix, Amazon Prime" />
                <ReleaseField label="TV broadcaster" value={tvBroadcaster} onChange={setTvBroadcaster} placeholder="e.g. BBC, HBO" />
                <ReleaseField label="Cinema release" value={cinemaRelease} onChange={setCinemaRelease} placeholder="e.g. AMC, Regal" />
                <ReleaseField label="Official website" value={officialWebsite} onChange={setOfficialWebsite} placeholder="https://" />
                <ReleaseField label="Trailer link" value={trailerLink} onChange={setTrailerLink} placeholder="https://" />
                <div>
                  <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Release date</label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => { setShowReleaseForm(false); setShowConfirm(true); }} className="flex-1">
                  Continue
                </Button>
                <Button variant="secondary" onClick={() => setShowReleaseForm(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {showConfirm && selectedStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={() => setShowConfirm(false)}>
          <Card className="p-6 max-w-md w-full animate-scale-in">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-coral-50 dark:bg-coral-900/20 flex items-center justify-center">
                  <Archive className="w-5 h-5 text-coral-600 dark:text-coral-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">Archive screenplay?</h3>
                  <p className="text-xs text-ink-400 dark:text-ink-500">Setting status to {LIFECYCLE_STATUS_LABELS[selectedStatus]}</p>
                </div>
              </div>

              <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-ink-900 dark:text-white mb-2">This will:</p>
                <ul className="space-y-1.5 text-xs text-ink-600 dark:text-ink-300">
                  <li className="flex items-start gap-2"><X className="w-3.5 h-3.5 text-coral-500 flex-shrink-0 mt-0.5" /> Remove the screenplay from reader assignments</li>
                  <li className="flex items-start gap-2"><X className="w-3.5 h-3.5 text-coral-500 flex-shrink-0 mt-0.5" /> Remove it from Producer Discovery</li>
                  <li className="flex items-start gap-2"><X className="w-3.5 h-3.5 text-coral-500 flex-shrink-0 mt-0.5" /> Prevent future reviews</li>
                  <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-forest-500 flex-shrink-0 mt-0.5" /> Preserve all analytics and engagement history</li>
                  <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-forest-500 flex-shrink-0 mt-0.5" /> Notify followers of the status change</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Archive reason (optional)</label>
                <textarea
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Optioned by Paramount Pictures"
                  className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 text-sm resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleConfirm} disabled={submitting} className="flex-1">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Archiving...</> : 'Confirm & archive'}
                </Button>
                <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

function ReleaseField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 text-sm"
      />
    </div>
  );
}
