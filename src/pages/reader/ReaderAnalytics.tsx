import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, TrendingUp, Users, ThumbsUp, Eye, Clock, Star, ShieldCheck, Heart, Film } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, StatCard, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RetentionCurve } from '@/components/charts/RetentionCurve';
import { ConfidenceGauge } from '@/components/charts/ConfidenceGauge';
import { RatingBreakdown } from '@/components/charts/RatingBreakdown';
import {
  getCoverColor, relativeTime, formatDuration,
  type ReaderReviewedScreenplay, type ReaderFeedback, type ReadingSession,
  type ReleaseInfo, type LifecycleStatus, LIFECYCLE_STATUS_LABELS,
} from '@/lib/types';
import { computeRetentionCurve, computeDropOffPoints, computeEngagementSummary, computeConfidenceScore } from '@/lib/analytics';

interface ReaderAnalyticsProps {
  screenplayId: string;
  navigate: (to: string) => void;
}

export function ReaderAnalytics({ screenplayId, navigate }: ReaderAnalyticsProps) {
  const { profile } = useAuth();
  const [discovery, setDiscovery] = useState<ReaderReviewedScreenplay | null>(null);
  const [feedback, setFeedback] = useState<ReaderFeedback[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [isFollowed, setIsFollowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);

  useEffect(() => {
    async function load() {
      if (!profile) return;

      const [discRes, fbRes, sessRes, followRes, releaseRes] = await Promise.all([
        supabase.from('reader_reviewed_screenplays').select('*').eq('id', screenplayId).maybeSingle(),
        supabase.from('reader_feedback').select('*').eq('screenplay_id', screenplayId).order('submitted_at', { ascending: false }),
        supabase.from('reading_sessions').select('*').eq('screenplay_id', screenplayId).order('started_at', { ascending: true }),
        supabase.from('screenplay_followers').select('id').eq('screenplay_id', screenplayId).eq('reader_id', profile.id).maybeSingle(),
        supabase.from('release_info').select('*').eq('screenplay_id', screenplayId).maybeSingle(),
      ]);

      setDiscovery(discRes.data as ReaderReviewedScreenplay | null);
      setFeedback((fbRes.data as ReaderFeedback[]) ?? []);
      setSessions((sessRes.data as ReadingSession[]) ?? []);
      setIsFollowed(!!followRes.data);
      setReleaseInfo(releaseRes.data as ReleaseInfo | null);
      setLoading(false);

      const { data: myFeedback } = await supabase
        .from('reader_feedback')
        .select('id')
        .eq('screenplay_id', screenplayId)
        .eq('reader_id', profile.id)
        .maybeSingle();
      if (!myFeedback) setNotAuthorized(true);
    }
    load();
  }, [screenplayId, profile]);

  const handleFollow = async () => {
    if (!profile) return;
    if (isFollowed) {
      await supabase.from('screenplay_followers').delete().eq('screenplay_id', screenplayId).eq('reader_id', profile.id);
      setIsFollowed(false);
    } else {
      await supabase.from('screenplay_followers').insert({ screenplay_id: screenplayId, reader_id: profile.id });
      setIsFollowed(true);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading analytics...</div>;
  }

  if (notAuthorized) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 dark:text-ink-400 mb-4">You can only view analytics for screenplays you have reviewed.</p>
        <Button variant="secondary" onClick={() => navigate('/reader/history')}>Back to history</Button>
      </div>
    );
  }

  if (!discovery) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 dark:text-ink-400 mb-4">Screenplay not found.</p>
        <Button variant="secondary" onClick={() => navigate('/reader/history')}>Back to history</Button>
      </div>
    );
  }

  const colors = getCoverColor(discovery.cover_color);
  const totalReaders = discovery.reader_count;
  const completionRate = Math.round(discovery.completion_rate);
  const recommendRate = Math.round(discovery.recommend_rate);
  const confidence = computeConfidenceScore(totalReaders, completionRate, discovery.feedback_count);

  const retention = computeRetentionCurve(sessions, discovery.page_count, totalReaders);
  const dropOffs = computeDropOffPoints(retention);
  const engagement = computeEngagementSummary(sessions);

  const avgRatings = feedback.length > 0 ? [
    { label: 'Story', value: feedback.reduce((s, f) => s + f.story_rating, 0) / feedback.length, key: 'story' },
    { label: 'Characters', value: feedback.reduce((s, f) => s + f.characters_rating, 0) / feedback.length, key: 'characters' },
    { label: 'Pacing', value: feedback.reduce((s, f) => s + f.pacing_rating, 0) / feedback.length, key: 'pacing' },
    { label: 'Dialogue', value: feedback.reduce((s, f) => s + f.dialogue_rating, 0) / feedback.length, key: 'dialogue' },
  ] : [];

  const isArchived = discovery.lifecycle_status !== 'active';
  const hasRelease = discovery.lifecycle_status === 'available_to_watch' && releaseInfo;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/reader/history')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to history
      </button>

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
                  {isArchived && <Badge color="slate">{LIFECYCLE_STATUS_LABELS[discovery.lifecycle_status as LifecycleStatus]}</Badge>}
                </div>
                <p className="text-ink-500 dark:text-ink-400 mb-2">{discovery.logline}</p>
                <div className="flex items-center gap-3 text-xs text-ink-400 dark:text-ink-500 flex-wrap">
                  <span>{discovery.page_count} pages</span>
                  <span>· by Anonymous Writer</span>
                </div>
              </div>
            </div>
            <Button variant={isFollowed ? 'ghost' : 'secondary'} onClick={handleFollow} className={isFollowed ? 'text-coral-600' : ''}>
              <Heart className={`w-4 h-4 ${isFollowed ? 'fill-coral-500' : ''}`} />
              {isFollowed ? 'Unfollow' : 'Follow screenplay'}
            </Button>
          </div>
        </div>
      </Card>

      {hasRelease && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Film className="w-5 h-5 text-accent-500" />
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Available to Watch</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {releaseInfo!.streaming_platform && <ReleaseItem label="Streaming Platform" value={releaseInfo!.streaming_platform} />}
            {releaseInfo!.tv_broadcaster && <ReleaseItem label="TV Broadcaster" value={releaseInfo!.tv_broadcaster} />}
            {releaseInfo!.cinema_release && <ReleaseItem label="Cinema Release" value={releaseInfo!.cinema_release} />}
            {releaseInfo!.official_website && <ReleaseItem label="Official Website" value={releaseInfo!.official_website} link />}
            {releaseInfo!.trailer_link && <ReleaseItem label="Trailer" value={releaseInfo!.trailer_link} link />}
            {releaseInfo!.release_date && <ReleaseItem label="Release Date" value={new Date(releaseInfo!.release_date).toLocaleDateString()} />}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Readers" value={totalReaders} sublabel="independent readers" accent="sea" />
        <StatCard label="Completion" value={`${completionRate}%`} sublabel={`${discovery.completed_count} finished`} accent="forest" />
        <StatCard label="Recommend" value={`${recommendRate}%`} sublabel={`${discovery.recommend_count} of ${discovery.feedback_count}`} accent="accent" />
        <StatCard label="Avg rating" value={discovery.avg_rating.toFixed(1)} sublabel={`${discovery.feedback_count} reviews`} accent="ink" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Reader retention</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">How many readers reached each page</p>
            </div>
            <TrendingUp className="w-5 h-5 text-ink-300" />
          </div>
          <RetentionCurve data={retention} dropOffs={dropOffs} />
          {dropOffs.length > 0 && (
            <div className="mt-6 pt-6 border-t border-ink-100 dark:border-ink-800">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">Drop-off points</h3>
              <div className="space-y-2">
                {dropOffs.slice(0, 3).map((drop) => (
                  <div key={drop.page} className="flex items-center justify-between text-sm">
                    <span className="text-ink-600 dark:text-ink-300">Page {drop.page}</span>
                    <span className="text-coral-600 font-medium">-{drop.dropCount} readers ({drop.dropPercentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Confidence score</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-6 text-center">Based on reader volume, completion, and feedback</p>
          <ConfidenceGauge score={confidence.score} level={confidence.level} label={confidence.label} />
          <div className="mt-6 w-full space-y-2 text-xs">
            <div className="flex justify-between text-ink-500 dark:text-ink-400">
              <span>Reader volume</span>
              <span className="font-medium text-ink-700 dark:text-ink-200">{totalReaders} / 10+</span>
            </div>
            <div className="flex justify-between text-ink-500 dark:text-ink-400">
              <span>Completion rate</span>
              <span className="font-medium text-ink-700 dark:text-ink-200">{completionRate}%</span>
            </div>
            <div className="flex justify-between text-ink-500 dark:text-ink-400">
              <span>Feedback count</span>
              <span className="font-medium text-ink-700 dark:text-ink-200">{discovery.feedback_count}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Engagement signals</h2>
          <div className="grid grid-cols-2 gap-4">
            <SignalBox icon={Eye} label="Return rate" value={`${discovery.return_rate}%`} sub={`${discovery.return_sessions} of ${discovery.total_sessions} sessions`} />
            <SignalBox icon={Clock} label="Avg session" value={formatDuration(engagement.avgDuration)} sub={`${engagement.totalSessions} total sessions`} />
            <SignalBox icon={TrendingUp} label="Avg last page" value={`${Math.round(discovery.avg_last_page)}`} sub={`of ${discovery.page_count} pages`} />
            <SignalBox icon={ThumbsUp} label="Recommend" value={`${recommendRate}%`} sub={`${discovery.recommend_count} of ${discovery.feedback_count}`} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Dimensional ratings</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-5">Average across {feedback.length} reader reviews</p>
          {avgRatings.length > 0 ? (
            <RatingBreakdown ratings={avgRatings} />
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-ink-400 dark:text-ink-500">No ratings yet</div>
          )}
        </Card>
      </div>

      {feedback.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Anonymous reader feedback</h2>
          <div className="space-y-4">
            {feedback.map((fb, i) => (
              <div key={fb.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 pb-4 last:pb-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-xs font-semibold text-ink-600 dark:text-ink-300">
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium text-ink-900 dark:text-white">Anonymous reader</span>
                  <div className="flex items-center gap-1">
                    {[...Array(10)].map((_, idx) => (
                      <Star key={idx} className={`w-3 h-3 ${idx < fb.overall_rating ? 'fill-accent-400 text-accent-400' : 'text-ink-200'}`} />
                    ))}
                  </div>
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

      <div className="flex items-center justify-center gap-2 text-xs text-ink-400 dark:text-ink-500 py-2">
        <ShieldCheck className="w-3.5 h-3.5" />
        Analytics are anonymous and aggregated. Writer and reader identities are not disclosed.
      </div>
    </div>
  );
}

function SignalBox({ icon: Icon, label, value, sub }: { icon: typeof Eye; label: string; value: string; sub: string }) {
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

function ReleaseItem({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-0.5">{label}</div>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent-600 dark:text-accent-400 hover:underline">{value}</a>
      ) : (
        <div className="text-sm font-medium text-ink-900 dark:text-white">{value}</div>
      )}
    </div>
  );
}
