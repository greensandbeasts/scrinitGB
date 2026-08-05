import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Clock, FileText, CheckCircle, XCircle, Star, ThumbsUp, ThumbsDown, Sparkles, Award, Lock, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  getCoverColor, relativeTime, formatDuration,
  type Screenplay, type ReaderFeedback, type Assignment, type ReadingSession,
  type FeedbackQualityScore, type ReleaseInfo, type LifecycleStatus, LIFECYCLE_STATUS_LABELS,
} from '@/lib/types';
import { STOP_REASONS } from '@/lib/contribution';

interface ReaderReviewProps {
  screenplayId: string;
  navigate: (to: string) => void;
}

export function ReaderReview({ screenplayId, navigate }: ReaderReviewProps) {
  const { profile } = useAuth();
  const [screenplay, setScreenplay] = useState<Screenplay | null>(null);
  const [feedback, setFeedback] = useState<ReaderFeedback | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [qualityScore, setQualityScore] = useState<FeedbackQualityScore | null>(null);
  const [contributionPoints, setContributionPoints] = useState<number>(0);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [isFollowed, setIsFollowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;

      const [spRes, fbRes, releaseRes, followRes] = await Promise.all([
        supabase.from('screenplays').select('*').eq('id', screenplayId).maybeSingle(),
        supabase.from('reader_feedback').select('*').eq('screenplay_id', screenplayId).eq('reader_id', profile.id).maybeSingle(),
        supabase.from('release_info').select('*').eq('screenplay_id', screenplayId).maybeSingle(),
        supabase.from('screenplay_followers').select('id').eq('screenplay_id', screenplayId).eq('reader_id', profile.id).maybeSingle(),
      ]);

      setScreenplay(spRes.data as Screenplay | null);
      setFeedback(fbRes.data as ReaderFeedback | null);
      setReleaseInfo(releaseRes.data as ReleaseInfo | null);
      setIsFollowed(!!followRes.data);

      const fb = fbRes.data as ReaderFeedback | null;

      if (fb?.assignment_id) {
        const [assignRes, sessRes, qsRes, contribRes] = await Promise.all([
          supabase.from('assignments').select('*').eq('id', fb.assignment_id).maybeSingle(),
          supabase.from('reading_sessions').select('*').eq('assignment_id', fb.assignment_id).order('session_number', { ascending: true }),
          supabase.from('feedback_quality_scores').select('*').eq('feedback_id', fb.id).maybeSingle(),
          supabase.from('contribution_events').select('points_awarded').eq('assignment_id', fb.assignment_id).eq('reader_id', profile.id),
        ]);
        setAssignment(assignRes.data as Assignment | null);
        setSessions((sessRes.data as ReadingSession[]) ?? []);
        setQualityScore(qsRes.data as FeedbackQualityScore | null);
        const totalPoints = ((contribRes.data as { points_awarded: number }[]) ?? []).reduce((sum, c) => sum + c.points_awarded, 0);
        setContributionPoints(totalPoints);
      }

      setLoading(false);
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
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading your review...</div>;
  }

  if (!screenplay || !feedback) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 dark:text-ink-400 mb-4">Review not found. You may not have submitted feedback for this screenplay.</p>
        <Button variant="secondary" onClick={() => navigate('/reader/history')}>Back to history</Button>
      </div>
    );
  }

  const colors = getCoverColor(screenplay.cover_color);
  const totalActiveSeconds = sessions.reduce((sum, s) => sum + (s.active_reading_seconds ?? 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  const isComplete = feedback.completion_status === 'completed';
  const stopReasonLabel = STOP_REASONS.find((r) => r.value === feedback.stop_reason)?.label ?? feedback.stop_reason;
  const isArchived = screenplay.lifecycle_status !== 'active';
  const hasRelease = screenplay.lifecycle_status === 'available_to_watch' && releaseInfo;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate('/reader/history')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to history
      </button>

      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-ink-400" />
        <span className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider">Read-only — reviews cannot be edited after submission</span>
      </div>

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
                  <h1 className="text-2xl font-bold text-ink-900 dark:text-white">{screenplay.title}</h1>
                  <Badge color="ink">{screenplay.genre}</Badge>
                  {isArchived && <Badge color="slate">{LIFECYCLE_STATUS_LABELS[screenplay.lifecycle_status as LifecycleStatus]}</Badge>}
                </div>
                <p className="text-ink-500 dark:text-ink-400 text-sm">{screenplay.page_count} pages · by Anonymous Writer</p>
              </div>
            </div>
            <Button variant={isFollowed ? 'ghost' : 'secondary'} onClick={handleFollow} className={isFollowed ? 'text-coral-600' : ''}>
              <Heart className={`w-4 h-4 ${isFollowed ? 'fill-coral-500' : ''}`} />
              {isFollowed ? 'Unfollow' : 'Follow'}
            </Button>
          </div>
        </div>
      </Card>

      {hasRelease && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">Available to Watch</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {releaseInfo!.streaming_platform && <div><div className="text-xs text-ink-400 mb-0.5">Streaming</div><div className="font-medium text-ink-900 dark:text-white">{releaseInfo!.streaming_platform}</div></div>}
            {releaseInfo!.tv_broadcaster && <div><div className="text-xs text-ink-400 mb-0.5">TV Broadcaster</div><div className="font-medium text-ink-900 dark:text-white">{releaseInfo!.tv_broadcaster}</div></div>}
            {releaseInfo!.cinema_release && <div><div className="text-xs text-ink-400 mb-0.5">Cinema</div><div className="font-medium text-ink-900 dark:text-white">{releaseInfo!.cinema_release}</div></div>}
            {releaseInfo!.official_website && <div><div className="text-xs text-ink-400 mb-0.5">Website</div><a href={releaseInfo!.official_website} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-600 hover:underline">{releaseInfo!.official_website}</a></div>}
            {releaseInfo!.trailer_link && <div><div className="text-xs text-ink-400 mb-0.5">Trailer</div><a href={releaseInfo!.trailer_link} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-600 hover:underline">Watch trailer</a></div>}
            {releaseInfo!.release_date && <div><div className="text-xs text-ink-400 mb-0.5">Release Date</div><div className="font-medium text-ink-900 dark:text-white">{new Date(releaseInfo!.release_date).toLocaleDateString()}</div></div>}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Reading session</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SessionStat icon={isComplete ? CheckCircle : XCircle} label="Status" value={isComplete ? 'Completed' : 'Stopped'} color={isComplete ? 'text-forest-600' : 'text-coral-600'} />
          <SessionStat icon={FileText} label="Page reached" value={`${feedback.stop_page ?? sessions[0]?.last_page_reached ?? 0} / ${screenplay.page_count}`} />
          <SessionStat icon={Clock} label="Active reading" value={formatDuration(totalActiveSeconds)} />
          <SessionStat icon={Clock} label="Total time" value={formatDuration(totalDuration)} />
          <SessionStat icon={Clock} label="Sessions" value={String(sessions.length)} />
          <SessionStat icon={FileText} label="Submitted" value={relativeTime(feedback.submitted_at)} />
        </div>
        {!isComplete && feedback.stop_reason && (
          <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800">
            <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">Stop reason</div>
            <div className="text-sm font-medium text-ink-900 dark:text-white">{stopReasonLabel}</div>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Your ratings</h2>

        <div>
          <div className="text-sm text-ink-500 dark:text-ink-400 mb-2">Overall rating</div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${n <= feedback.overall_rating ? 'bg-accent-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-300'}`}>
                {n}
              </div>
            ))}
            <span className="ml-2 text-sm font-bold text-ink-900 dark:text-white">{feedback.overall_rating}/10</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <ReadonlyRatingSlider label="Story" value={feedback.story_rating} />
          <ReadonlyRatingSlider label="Characters" value={feedback.characters_rating} />
          <ReadonlyRatingSlider label="Pacing" value={feedback.pacing_rating} />
          <ReadonlyRatingSlider label="Dialogue" value={feedback.dialogue_rating} />
        </div>

        <div>
          <div className="text-sm text-ink-500 dark:text-ink-400 mb-2">Recommendation</div>
          <div className="flex items-center gap-3">
            {feedback.would_recommend ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-forest-50 dark:bg-forest-900/20 text-forest-700 dark:text-forest-400 text-sm font-medium">
                <ThumbsUp className="w-4 h-4" /> Recommends
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-coral-50 dark:bg-coral-900/20 text-coral-700 dark:text-coral-400 text-sm font-medium">
                <ThumbsDown className="w-4 h-4" /> Does not recommend
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-3">Your written feedback</h2>
        <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed whitespace-pre-wrap">{feedback.written_feedback}</p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {qualityScore && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent-500" />
              <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Feedback Quality Score</h3>
            </div>
            <div className="text-3xl font-bold text-ink-900 dark:text-white tabular-nums mb-1">
              {(qualityScore.quality_score * 100).toFixed(0)}<span className="text-lg text-ink-400">/100</span>
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400">{qualityScore.analysis_text}</p>
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-forest-500" />
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Contribution Points</h3>
          </div>
          <div className="text-3xl font-bold text-forest-600 dark:text-forest-400 tabular-nums mb-1">
            +{contributionPoints}
          </div>
          <p className="text-xs text-ink-500 dark:text-ink-400">Awarded for your reading and feedback</p>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => navigate(`/reader/analytics/${screenplayId}`)}>
          View Analytics
        </Button>
        <Button variant="ghost" onClick={() => navigate('/reader/history')}>Back to history</Button>
      </div>
    </div>
  );
}

function SessionStat({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-sm font-bold ${color ?? 'text-ink-900 dark:text-white'}`}>{value}</div>
    </div>
  );
}

function ReadonlyRatingSlider({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-ink-700 dark:text-ink-300">{label}</label>
        <span className="text-sm font-bold text-ink-900 dark:text-white tabular-nums">{value}/10</span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <div key={n} className={`flex-1 h-7 rounded-md ${n <= value ? 'bg-accent-400' : 'bg-ink-100 dark:bg-ink-800'}`} />
        ))}
      </div>
    </div>
  );
}
