import { useEffect, useState } from 'react';
import {
  ArrowLeft, BookOpen, Users, TrendingUp, ThumbsUp, Eye, Clock,
  Mail, Check, AlertCircle, FileText, Sparkles, Film,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RatingBreakdown } from '@/components/charts/RatingBreakdown';
import { ConfidenceGauge } from '@/components/charts/ConfidenceGauge';
import { getCoverColor, relativeTime, type ScreenplayDiscovery, type ReaderFeedback, type IndustryRequest } from '@/lib/types';
import { computeConfidenceScore } from '@/lib/analytics';
import { SecureScreenplayReader } from '@/components/reader/SecureScreenplayReader';

interface IndustryScreenplayDetailProps {
  screenplayId: string;
  navigate: (to: string) => void;
}

type Phase = 'detail' | 'reading';

export function IndustryScreenplayDetail({ screenplayId, navigate }: IndustryScreenplayDetailProps) {
  const { profile } = useAuth();
  const [discovery, setDiscovery] = useState<ScreenplayDiscovery | null>(null);
  const [feedback, setFeedback] = useState<ReaderFeedback[]>([]);
  const [existingRequest, setExistingRequest] = useState<IndustryRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>('detail');

  useEffect(() => {
    async function load() {
      const [discRes, fbRes, reqRes] = await Promise.all([
        supabase.from('screenplay_discovery').select('*').eq('id', screenplayId).maybeSingle(),
        supabase.from('reader_feedback').select('*').eq('screenplay_id', screenplayId).order('submitted_at', { ascending: false }),
        profile ? supabase.from('industry_requests').select('*').eq('screenplay_id', screenplayId).eq('industry_user_id', profile.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setDiscovery(discRes.data as ScreenplayDiscovery | null);
      setFeedback((fbRes.data as ReaderFeedback[]) ?? []);
      setExistingRequest(reqRes.data as IndustryRequest | null);
      setLoading(false);
    }
    load();
  }, [screenplayId, profile]);

  const handleRequest = async () => {
    if (!profile || !discovery) return;
    setSubmitting(true);
    const { data } = await supabase.from('industry_requests').insert({
      screenplay_id: screenplayId,
      industry_user_id: profile.id,
      writer_id: discovery.writer_id,
      message: requestMessage || 'I would like to request an introduction to the writer.',
      reason_for_contact: requestReason || null,
      request_type: 'introduction',
      company_snapshot: profile.company,
      profession_snapshot: profile.bio,
    }).select('*').maybeSingle();
    setExistingRequest(data as IndustryRequest | null);
    setSubmitting(false);
    setShowRequestModal(false);
    setRequestMessage('');
    setRequestReason('');

    // Create notification for the writer
    if (data) {
      await supabase.rpc('create_notification', {
        p_user_id: discovery.writer_id,
        p_type: 'introduction_request',
        p_title: 'New introduction request',
        p_body: 'An industry professional has requested an introduction to you.',
        p_screenplay_id: screenplayId,
        p_request_id: data.id,
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading screenplay insights...</div>;
  }

  if (!discovery) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 dark:text-ink-400 mb-4">Screenplay not found or not qualified for discovery.</p>
        <Button variant="secondary" onClick={() => navigate('/industry')}>Back to discovery</Button>
      </div>
    );
  }

  if (discovery.lifecycle_status !== 'active') {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 dark:text-ink-400 mb-4">This screenplay is no longer available for discovery.</p>
        <Button variant="secondary" onClick={() => navigate('/industry')}>Back to discovery</Button>
      </div>
    );
  }

  // ─── READING PHASE ─────────────────────────────────────────────────────
  if (phase === 'reading') {
    return (
      <SecureScreenplayReader
        screenplayId={screenplayId}
        screenplayTitle={discovery.title}
        pageCount={discovery.page_count}
        coverColor={discovery.cover_color}
        mode="industry"
        onExit={() => setPhase('detail')}
        onComplete={() => setPhase('detail')}
      />
    );
  }

  // ─── DETAIL PHASE ──────────────────────────────────────────────────────
  const colors = getCoverColor(discovery.cover_color);
  const confidence = computeConfidenceScore(discovery.reader_count, discovery.completion_rate, discovery.feedback_count);
  const avgRatings = feedback.length > 0 ? [
    { label: 'Story', value: feedback.reduce((s, f) => s + f.story_rating, 0) / feedback.length, key: 'story' },
    { label: 'Characters', value: feedback.reduce((s, f) => s + f.characters_rating, 0) / feedback.length, key: 'characters' },
    { label: 'Pacing', value: feedback.reduce((s, f) => s + f.pacing_rating, 0) / feedback.length, key: 'pacing' },
    { label: 'Dialogue', value: feedback.reduce((s, f) => s + f.dialogue_rating, 0) / feedback.length, key: 'dialogue' },
  ] : [];

  const requestStatus = existingRequest?.status;
  const identityRevealed = existingRequest?.identity_revealed;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/industry')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to discovery
      </button>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${colors.gradient}`} />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-5">
              <div className={`w-16 h-20 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-lg`}>
                <BookOpen className="w-6 h-6 text-white/80" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-ink-900 dark:text-white">{discovery.title}</h1>
                  <Badge color="ink">{discovery.genre}</Badge>
                  {discovery.format_type && <Badge color="slate">{discovery.format_type}</Badge>}
                </div>
                <p className="text-ink-500 dark:text-ink-400 mb-2">{discovery.logline}</p>
                <div className="flex items-center gap-3 text-xs text-ink-400 dark:text-ink-500 flex-wrap">
                  <span>{discovery.page_count} pages</span>
                  {discovery.budget_range && <span>· {discovery.budget_range}</span>}
                  <span>· by Anonymous Writer</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button onClick={() => setPhase('reading')}>
                <BookOpen className="w-4 h-4" /> Read screenplay
              </Button>
              {requestStatus === 'pending' ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 text-sm font-medium">
                  <Clock className="w-4 h-4" /> Request pending
                </div>
              ) : requestStatus === 'approved' && identityRevealed ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-forest-50 dark:bg-forest-900/20 text-forest-700 dark:text-forest-400 text-sm font-medium">
                  <Check className="w-4 h-4" /> Identity revealed
                </div>
              ) : requestStatus === 'declined' ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-coral-50 dark:bg-coral-900/20 text-coral-700 dark:text-coral-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" /> Request declined
                </div>
              ) : !existingRequest ? (
                <Button variant="secondary" onClick={() => setShowRequestModal(true)}>
                  <Mail className="w-4 h-4" /> Request introduction
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {/* Metadata */}
      {(discovery.secondary_genre || discovery.themes.length > 0 || discovery.primary_setting || discovery.time_period || discovery.tone || discovery.target_audience) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Screenplay details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {discovery.secondary_genre && <MetaItem label="Secondary Genre" value={discovery.secondary_genre} />}
            {discovery.primary_setting && <MetaItem label="Setting" value={discovery.primary_setting} />}
            {discovery.time_period && <MetaItem label="Time Period" value={discovery.time_period} />}
            {discovery.tone && <MetaItem label="Tone" value={discovery.tone} />}
            {discovery.target_audience && <MetaItem label="Audience" value={discovery.target_audience} />}
            {discovery.budget_range && <MetaItem label="Budget" value={discovery.budget_range} />}
          </div>
          {discovery.themes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800">
              <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">Themes</div>
              <div className="flex flex-wrap gap-2">
                {discovery.themes.map(t => <Badge key={t} color="accent">{t}</Badge>)}
              </div>
            </div>
          )}
          {discovery.tags.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {discovery.tags.map(tag => <span key={tag} className="text-xs text-ink-400 dark:text-ink-500">#{tag}</span>)}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Readers" value={discovery.reader_count} sublabel="independent readers" accent="sea" />
        <StatCard label="Completion" value={`${discovery.completion_rate}%`} sublabel={`${discovery.completed_count} finished`} accent="forest" />
        <StatCard label="Recommend" value={`${discovery.recommend_rate}%`} sublabel={`${discovery.recommend_count} of ${discovery.feedback_count}`} accent="accent" />
        <StatCard label="Avg rating" value={discovery.avg_rating} sublabel={`${discovery.feedback_count} reviews`} accent="ink" />
      </div>

      {/* Confidence + ratings */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Confidence score</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-6 text-center">Based on reader volume, completion, and feedback consistency</p>
          <ConfidenceGauge score={confidence.score} level={confidence.level} label={confidence.label} />
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Dimensional ratings</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-5">Average across {feedback.length} reader reviews</p>
          {avgRatings.length > 0 ? (
            <RatingBreakdown ratings={avgRatings} />
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-ink-400 dark:text-ink-500">No ratings yet</div>
          )}
        </Card>
      </div>

      {/* Engagement signals */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Engagement signals</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SignalBox icon={Users} label="Total readers" value={String(discovery.reader_count)} sub={`${discovery.completed_count} completed`} />
          <SignalBox icon={TrendingUp} label="Completion rate" value={`${discovery.completion_rate}%`} sub={`${discovery.abandoned_count} abandoned`} />
          <SignalBox icon={ThumbsUp} label="Recommend rate" value={`${discovery.recommend_rate}%`} sub={`${discovery.recommend_count} recommend`} />
          <SignalBox icon={Eye} label="Return rate" value={`${discovery.return_rate}%`} sub={`${discovery.return_sessions} return sessions`} />
        </div>
      </Card>

      {/* Synopsis */}
      {discovery.synopsis && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-3">Synopsis</h2>
          <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed">{discovery.synopsis}</p>
        </Card>
      )}

      {/* Reader feedback */}
      {feedback.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Reader feedback</h2>
          <div className="space-y-4">
            {feedback.map((fb, i) => (
              <div key={fb.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 pb-4 last:pb-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-xs font-semibold text-ink-600 dark:text-ink-300">
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium text-ink-900 dark:text-white">Anonymous reader</span>
                  <Badge color={fb.would_recommend ? 'forest' : 'coral'}>
                    {fb.would_recommend ? 'Recommends' : 'Does not recommend'}
                  </Badge>
                  <span className="text-xs text-ink-400 dark:text-ink-500 ml-auto">{relativeTime(fb.submitted_at)}</span>
                </div>
                <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed pl-11">{fb.written_feedback}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Request modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={() => setShowRequestModal(false)}>
          <Card className="p-6 max-w-md w-full animate-scale-in">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-ink-600 dark:text-ink-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">Request introduction</h3>
                  <p className="text-xs text-ink-400 dark:text-ink-500">to the writer of {discovery.title}</p>
                </div>
              </div>
              <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">The writer will receive your request and can choose to reveal their identity. No identities are shared before approval.</p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Reason for contact</label>
                  <select
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600"
                  >
                    <option value="">Select...</option>
                    <option value="option">Interested in optioning</option>
                    <option value="representation">Interested in representation</option>
                    <option value="development">Development opportunity</option>
                    <option value="financing">Financing discussion</option>
                    <option value="collaboration">Collaboration inquiry</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={4}
                  placeholder="Introduce yourself and explain why you're interested..."
                  className="w-full px-4 py-3 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all resize-none text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRequest} disabled={submitting} className="flex-1">
                  {submitting ? 'Sending...' : 'Send request'}
                </Button>
                <Button variant="secondary" onClick={() => setShowRequestModal(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-medium text-ink-900 dark:text-white">{value}</div>
    </div>
  );
}

function SignalBox({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub: string }) {
  return (
    <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-ink-400 dark:text-ink-500" />
        <span className="text-xs font-medium text-ink-400 dark:text-ink-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-ink-900 dark:text-white tabular-nums">{value}</div>
      <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{sub}</div>
    </div>
  );
}
