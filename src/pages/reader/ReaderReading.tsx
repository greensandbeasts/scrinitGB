import { useEffect, useState } from 'react';
import {
  ArrowLeft, BookOpen, Check, ThumbsUp, ThumbsDown, Star,
  FileText, ShieldCheck, Clock, AlertCircle, Loader2, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  getCoverColor, type Assignment, type Screenplay, type FeedbackCompletion,
  type ContributionAlgorithmVersion, type RecommendChoice,
} from '@/lib/types';
import { ContinuousReader } from '@/components/reader/ContinuousReader';
import {
  analyzeFeedbackQuality, meetsFeedbackRequirements, STOP_REASONS,
} from '@/lib/contribution';

interface ReaderReadingProps {
  assignmentId: string;
  navigate: (to: string) => void;
}

type Phase = 'intro' | 'reading' | 'feedback' | 'recommend' | 'complete';

interface SessionData {
  scrollPosition: number;
  pagesRead: number;
  activeReadingSeconds: number;
  lastPageReached: number;
}

export function ReaderReading({ assignmentId, navigate }: ReaderReadingProps) {
  const { profile } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [screenplay, setScreenplay] = useState<Screenplay | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<boolean>(false);
  const [config, setConfig] = useState<ContributionAlgorithmVersion | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [loading, setLoading] = useState(true);

  // Session data captured from reader
  const [sessionData, setSessionData] = useState<SessionData>({
    scrollPosition: 0, pagesRead: 0, activeReadingSeconds: 0, lastPageReached: 0,
  });

  // Feedback form state
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [overallRating, setOverallRating] = useState(0);
  const [storyRating, setStoryRating] = useState(0);
  const [charactersRating, setCharactersRating] = useState(0);
  const [pacingRating, setPacingRating] = useState(0);
  const [dialogueRating, setDialogueRating] = useState(0);
  const [writtenFeedback, setWrittenFeedback] = useState('');
  const [stopReason, setStopReason] = useState<string>('');
  const [completionStatus, setCompletionStatus] = useState<FeedbackCompletion>('completed');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  // Recommend phase
  const [recommendChoice, setRecommendChoice] = useState<RecommendChoice | null>(null);
  const [contributionAwarded, setContributionAwarded] = useState<number>(0);

  useEffect(() => {
    async function load() {
      const [assignRes, fbRes, configRes] = await Promise.all([
        supabase.from('assignments').select('*').eq('id', assignmentId).maybeSingle(),
        supabase.from('reader_feedback').select('id').eq('assignment_id', assignmentId).maybeSingle(),
        supabase.rpc('get_algorithm_config'),
      ]);
      const a = assignRes.data as Assignment | null;
      setAssignment(a);
      setExistingFeedback(!!fbRes.data);
      setConfig(configRes.data as ContributionAlgorithmVersion | null);

      if (a) {
        const { data: sp } = await supabase.from('screenplays').select('*').eq('id', a.screenplay_id).maybeSingle();
        setScreenplay(sp as Screenplay | null);
      }
      setLoading(false);
    }
    load();
  }, [assignmentId]);

  const handleSubmitFeedback = async () => {
    if (!assignment || !screenplay || !profile || !config) return;

    setFeedbackError(null);

    // Validate feedback
    const qualityResult = analyzeFeedbackQuality(writtenFeedback);
    setQualityScore(qualityResult.score);

    const validation = meetsFeedbackRequirements(writtenFeedback, config, qualityResult.score);
    if (!validation.valid) {
      setFeedbackError(validation.reason);
      return;
    }

    setSubmitting(true);

    const algorithmVersionId = config.id;
    const isComplete = completionStatus === 'completed';
    const stopPage = sessionData.lastPageReached;

    // Insert feedback
    const { data: feedbackData, error: fbError } = await supabase.from('reader_feedback').insert({
      assignment_id: assignment.id,
      screenplay_id: screenplay.id,
      reader_id: profile.id,
      would_recommend: wouldRecommend ?? false,
      overall_rating: overallRating,
      story_rating: storyRating,
      characters_rating: charactersRating,
      pacing_rating: pacingRating,
      dialogue_rating: dialogueRating,
      written_feedback: writtenFeedback,
      completion_status: completionStatus,
      ai_quality_score: qualityResult.score,
      ai_quality_enabled: config.ai_quality_enabled,
      stop_page: stopPage,
      algorithm_version_id: algorithmVersionId,
    }).select('*').maybeSingle();

    if (fbError) {
      setFeedbackError('Failed to submit feedback. Please try again.');
      setSubmitting(false);
      return;
    }

    // Insert quality score
    if (feedbackData) {
      await supabase.from('feedback_quality_scores').insert({
        feedback_id: (feedbackData as { id: string }).id,
        reader_id: profile.id,
        screenplay_id: screenplay.id,
        quality_score: qualityResult.score,
        scores: qualityResult.scores,
        analysis_text: qualityResult.analysis,
        algorithm_version_id: algorithmVersionId,
      });
    }

    // Update assignment
    await supabase.from('assignments').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', assignment.id);

    // Check industry qualification
    await supabase.rpc('check_industry_qualification', { p_screenplay_id: screenplay.id });

    // Award contribution points via RPC
    const { data: awardResult } = await supabase.rpc('award_contribution_points', {
      p_reader_id: profile.id,
      p_screenplay_id: screenplay.id,
      p_assignment_id: assignment.id,
      p_reading_session_id: null,
      p_source: 'bonus',
      p_points: 0,
      p_breakdown: {},
    });

    // Mark assignment as contribution awarded
    await supabase.rpc('mark_assignment_contribution_awarded', { p_assignment_id: assignment.id });

    // Calculate contribution for display (not showing details to reader)
    const totalPoints = awardResult
      ? (awardResult as { contribution_points: number }).contribution_points
      : 0;

    setContributionAwarded(totalPoints);
    setSubmitting(false);
    setPhase('recommend');
  };

  const handleRecommendSubmit = async () => {
    if (!screenplay || !profile) return;
    // The recommendation is already stored as would_recommend in feedback.
    // The recommend choice is audience data only — it doesn't affect contribution points.
    // We stored would_recommend as a boolean, but now we have 3 choices.
    // Update the feedback to reflect the richer choice (stored in written_feedback or a separate field).
    // For now, just proceed to complete.
    setPhase('complete');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading screenplay...</div>;
  }

  if (!assignment || !screenplay) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 dark:text-ink-400 mb-4">Assignment not found.</p>
        <Button variant="secondary" onClick={() => navigate('/reader')}>Back to assignments</Button>
      </div>
    );
  }

  const colors = getCoverColor(screenplay.cover_color);
  const isComplete = sessionData.lastPageReached >= screenplay.page_count;

  // ─── READING PHASE ──────────────────────────────────────────────────────
  if (phase === 'reading') {
    return (
      <ContinuousReader
        screenplayId={screenplay.id}
        screenplayTitle={screenplay.title}
        pageCount={screenplay.page_count}
        coverColor={screenplay.cover_color}
        mode="reader"
        assignmentId={assignment.id}
        onReturnLater={(data) => {
          setSessionData(data);
          navigate('/reader');
        }}
        onStopReading={(data) => {
          setSessionData(data);
          setCompletionStatus(data.lastPageReached >= screenplay.page_count ? 'completed' : 'stopped_early');
          navigate(`/reader/feedback/${assignment.id}`);
        }}
        onLeaveReader={() => navigate('/reader')}
      />
    );
  }

  // ─── INTRO PHASE ────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/reader')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to assignments
        </button>

        <Card className="overflow-hidden">
          <div className={`h-2 bg-gradient-to-r ${colors.gradient}`} />
          <div className="p-8">
            <div className="flex items-start gap-5 mb-6">
              <div className={`w-16 h-20 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-lg`}>
                <BookOpen className="w-6 h-6 text-white/80" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="ink">{screenplay.genre}</Badge>
                  {screenplay.format_type && <Badge color="slate">{screenplay.format_type}</Badge>}
                  <span className="text-xs text-ink-400 dark:text-ink-500">{screenplay.page_count} pages</span>
                </div>
                <h1 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">{screenplay.title}</h1>
                <p className="text-ink-500 dark:text-ink-400">{screenplay.logline}</p>
              </div>
            </div>

            {screenplay.synopsis && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">Synopsis</h3>
                <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed">{screenplay.synopsis}</p>
              </div>
            )}

            <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-2">Before you begin</h3>
              <ul className="space-y-1.5 text-sm text-ink-600 dark:text-ink-300">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" /> Read at your own pace with continuous scrolling.</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" /> After page 3, you can Return Later or Stop Reading at any time.</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" /> Your reading position and time are saved automatically.</li>
                <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" /> Your identity remains anonymous. The screenplay is watermarked and protected.</li>
              </ul>
            </div>

            {existingFeedback && (
              <div className="flex items-center gap-2 text-sm text-forest-700 dark:text-forest-400 bg-forest-50 dark:bg-forest-900/20 rounded-xl p-3 mb-6">
                <Check className="w-4 h-4" /> You've already submitted feedback for this screenplay.
              </div>
            )}

            <Button size="lg" className="w-full" onClick={() => setPhase('reading')}>
              <BookOpen className="w-4 h-4" />
              {existingFeedback ? 'Read again' : 'Start reading'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── FEEDBACK PHASE ─────────────────────────────────────────────────────
  if (phase === 'feedback') {
    const minChars = config?.feedback_min_chars ?? 120;
    const maxChars = config?.feedback_max_chars ?? 500;
    const charCount = writtenFeedback.length;
    const charColor = charCount < minChars ? 'text-coral-500' : charCount > maxChars ? 'text-coral-500' : 'text-forest-500';

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/reader')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to assignments
        </button>

        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white tracking-tight">Your feedback</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">
            Share your honest assessment of <span className="font-medium text-ink-700 dark:text-ink-200">{screenplay.title}</span>.
            Your identity remains anonymous.
          </p>
        </div>

        {/* Reading summary */}
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">Page reached</div>
              <div className="text-lg font-bold text-ink-900 dark:text-white tabular-nums">{sessionData.lastPageReached} / {screenplay.page_count}</div>
            </div>
            <div>
              <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">Reading time</div>
              <div className="text-lg font-bold text-ink-900 dark:text-white tabular-nums">{Math.floor(sessionData.activeReadingSeconds / 60)}m {sessionData.activeReadingSeconds % 60}s</div>
            </div>
            <div>
              <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">Status</div>
              <div className="text-lg font-bold text-ink-900 dark:text-white">{isComplete ? 'Complete' : 'Stopped'}</div>
            </div>
          </div>
        </Card>

        {/* Stop reason (if not complete) */}
        {!isComplete && (
          <Card className="p-6">
            <label className="block text-sm font-semibold text-ink-900 dark:text-white mb-3">Why did you stop reading?</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {STOP_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  onClick={() => setStopReason(reason.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                    stopReason === reason.value
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400'
                      : 'border-ink-100 dark:border-ink-800 text-ink-500 dark:text-ink-400 hover:border-ink-200 dark:hover:border-ink-700'
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-6">
          {/* Ratings */}
          <div>
            <label className="block text-sm font-semibold text-ink-900 dark:text-white mb-3">Overall rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setOverallRating(n)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${n <= overallRating ? 'bg-accent-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-400 dark:text-ink-500 hover:bg-ink-200'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <RatingSlider label="Story" value={storyRating} onChange={setStoryRating} />
            <RatingSlider label="Characters" value={charactersRating} onChange={setCharactersRating} />
            <RatingSlider label="Pacing" value={pacingRating} onChange={setPacingRating} />
            <RatingSlider label="Dialogue" value={dialogueRating} onChange={setDialogueRating} />
          </div>

          {/* Written feedback */}
          <div>
            <label className="block text-sm font-semibold text-ink-900 dark:text-white mb-2">
              Written feedback <span className="text-ink-400 font-normal">({minChars}–{maxChars} characters)</span>
            </label>
            <textarea
              value={writtenFeedback}
              onChange={(e) => setWrittenFeedback(e.target.value.slice(0, maxChars))}
              rows={5}
              placeholder="Explain why you reacted the way you did. Discuss specific characters, dialogue, pacing, structure, or themes..."
              className="w-full px-4 py-3 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all resize-none text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-ink-400 dark:text-ink-500">
                {config?.ai_quality_enabled && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI quality analysis enabled
                  </span>
                )}
              </span>
              <span className={`text-xs tabular-nums ${charColor}`}>{charCount} / {maxChars}</span>
            </div>
          </div>

          {feedbackError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {feedbackError}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500">
            <FileText className="w-3.5 h-3.5" />
            Completion: {completionStatus === 'completed' ? 'Read in full' : completionStatus === 'partially_read' ? 'Partially read' : 'Stopped early'}
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmitFeedback}
            disabled={submitting || overallRating === 0 || writtenFeedback.length < minChars || (!isComplete && !stopReason)}
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit feedback'}
          </Button>
        </Card>
      </div>
    );
  }

  // ─── RECOMMEND PHASE ────────────────────────────────────────────────────
  if (phase === 'recommend') {
    return (
      <div className="max-w-lg mx-auto text-center py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white tracking-tight">Would you recommend this screenplay?</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-2">This is audience data only and does not affect your contribution points.</p>
        </div>

        <div className="space-y-3">
          <RecommendButton
            choice="recommend" current={recommendChoice} onSelect={setRecommendChoice}
            icon={<ThumbsUp className="w-5 h-5" />}
            label="Recommend" desc="I'd recommend this to others"
            color="forest"
          />
          <RecommendButton
            choice="consider" current={recommendChoice} onSelect={setRecommendChoice}
            icon={<Star className="w-5 h-5" />}
            label="Consider" desc="It has potential but needs work"
            color="accent"
          />
          <RecommendButton
            choice="pass" current={recommendChoice} onSelect={setRecommendChoice}
            icon={<ThumbsDown className="w-5 h-5" />}
            label="Pass" desc="I wouldn't recommend this"
            color="coral"
          />
        </div>

        <Button size="lg" className="w-full" onClick={handleRecommendSubmit} disabled={recommendChoice === null}>
          <Check className="w-4 h-4" /> Complete review
        </Button>
      </div>
    );
  }

  // ─── COMPLETE PHASE ─────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <Card className="p-8">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 dark:bg-forest-900/20 flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-forest-600 dark:text-forest-400" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-2">Review complete</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">
            Thank you for reading. Your engagement data and feedback contribute to the screenplay's audience intelligence profile.
          </p>
          <Button onClick={() => navigate('/reader/contribution')}>
            View your contribution
          </Button>
          <Button variant="ghost" onClick={() => navigate('/reader')} className="mt-2">
            Back to assignments
          </Button>
        </Card>
      </div>
    );
  }

  return null;
}

function RatingSlider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-ink-700 dark:text-ink-300">{label}</label>
        <span className="text-sm font-bold text-ink-900 dark:text-white tabular-nums">{value}/10</span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 h-7 rounded-md transition-all ${n <= value ? 'bg-accent-400' : 'bg-ink-100 dark:bg-ink-800 hover:bg-ink-200'}`}
          />
        ))}
      </div>
    </div>
  );
}

function RecommendButton({
  choice, current, onSelect, icon, label, desc, color,
}: {
  choice: RecommendChoice;
  current: RecommendChoice | null;
  onSelect: (c: RecommendChoice) => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: 'forest' | 'accent' | 'coral';
}) {
  const colorMap = {
    forest: 'border-forest-500 bg-forest-50 dark:bg-forest-900/20 text-forest-700 dark:text-forest-400',
    accent: 'border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400',
    coral: 'border-coral-500 bg-coral-50 dark:bg-coral-900/20 text-coral-700 dark:text-coral-400',
  };
  const isActive = current === choice;
  return (
    <button
      onClick={() => onSelect(choice)}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
        isActive ? colorMap[color] : 'border-ink-100 dark:border-ink-800 hover:border-ink-200 dark:hover:border-ink-700 text-ink-600 dark:text-ink-300'
      }`}
    >
      {icon}
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs opacity-80">{desc}</div>
      </div>
    </button>
  );
}
