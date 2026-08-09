import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Users, TrendingUp, Star, ThumbsUp, Eye, Clock, MessageSquare, ChevronRight, Building2, Mail, ShieldCheck, Film } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, StatCard, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RetentionCurve } from '@/components/charts/RetentionCurve';
import { ConfidenceGauge } from '@/components/charts/ConfidenceGauge';
import { RatingBreakdown } from '@/components/charts/RatingBreakdown';
import { getCoverColor, relativeTime, formatDuration, type Screenplay, type ReadingSession, type ReaderFeedback, type Assignment, type IndustryRequest, type IndustryReadingSession } from '@/lib/types';
import { computeRetentionCurve, computeDropOffPoints, computeEngagementSummary, computeConfidenceScore } from '@/lib/analytics';
import { ScreenplayLifecycleManager } from '@/components/writer/ScreenplayLifecycleManager';

interface WriterScreenplayDetailProps {
  screenplayId: string;
  navigate: (to: string) => void;
}

export function WriterScreenplayDetail({ screenplayId, navigate }: WriterScreenplayDetailProps) {
  const [screenplay, setScreenplay] = useState<Screenplay | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [feedback, setFeedback] = useState<ReaderFeedback[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [industrySessions, setIndustrySessions] = useState<IndustryReadingSession[]>([]);
  const [industryRequests, setIndustryRequests] = useState<IndustryRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [spRes, sessRes, fbRes, assignRes, indSessRes, indReqRes] = await Promise.all([
        supabase.from('screenplays').select('*').eq('id', screenplayId).maybeSingle(),
        supabase.from('reading_sessions').select('*').eq('screenplay_id', screenplayId).order('started_at', { ascending: true }),
        supabase.from('reader_feedback').select('*').eq('screenplay_id', screenplayId).order('submitted_at', { ascending: false }),
        supabase.from('assignments').select('*').eq('screenplay_id', screenplayId).order('reader_number', { ascending: true }),
        supabase.from('industry_reading_sessions').select('*').eq('screenplay_id', screenplayId).order('started_at', { ascending: false }),
        supabase.from('industry_requests').select('*').eq('screenplay_id', screenplayId).order('created_at', { ascending: false }),
      ]);    
      setScreenplay(spRes.data as Screenplay | null);
      setSessions((sessRes.data as ReadingSession[]) ?? []);
      setFeedback((fbRes.data as ReaderFeedback[]) ?? []);
      setAssignments((assignRes.data as Assignment[]) ?? []);
      setIndustrySessions((indSessRes.data as IndustryReadingSession[]) ?? []);
      setIndustryRequests((indReqRes.data as IndustryRequest[]) ?? []);
      setLoading(false);
    }
    load();
  }, [screenplayId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading screenplay...</div>;
  }

  console.log('Screenplay state:', screenplay);

if (!screenplay) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 dark:text-ink-400 dark:text-ink-500 mb-4">Screenplay not found.</p>
        <Button variant="secondary" onClick={() => navigate('/writer/screenplays')}>Back to screenplays</Button>
      </div>
    );
  }

  const colors = getCoverColor(screenplay.cover_color);
  const isDraft = screenplay.status === 'draft';
  const totalReaders = new Set(sessions.map((s) => s.reader_id)).size;
  const completedReaders = assignments.filter((a) => a.status === 'completed').length;
  const completionRate = totalReaders > 0 ? Math.round((completedReaders / totalReaders) * 100) : 0;
  const recommendCount = feedback.filter((f) => f.would_recommend).length;
  const recommendRate = feedback.length > 0 ? Math.round((recommendCount / feedback.length) * 100) : 0;
  const avgRating = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.overall_rating, 0) / feedback.length).toFixed(1)
    : '—';

  const retention = computeRetentionCurve(sessions, screenplay.page_count, totalReaders);
  const dropOffs = computeDropOffPoints(retention);
  const engagement = computeEngagementSummary(sessions);
  const confidence = computeConfidenceScore(totalReaders, completionRate, feedback.length);

  const avgRatings = feedback.length > 0 ? [
    { label: 'Story', value: feedback.reduce((s, f) => s + f.story_rating, 0) / feedback.length, key: 'story' },
    { label: 'Characters', value: feedback.reduce((s, f) => s + f.characters_rating, 0) / feedback.length, key: 'characters' },
    { label: 'Pacing', value: feedback.reduce((s, f) => s + f.pacing_rating, 0) / feedback.length, key: 'pacing' },
    { label: 'Dialogue', value: feedback.reduce((s, f) => s + f.dialogue_rating, 0) / feedback.length, key: 'dialogue' },
  ] : [];

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/writer/screenplays')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 hover:text-ink-900 dark:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to screenplays
      </button>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${colors.gradient}`} />
        <div className="p-6">
          <div className="flex items-start gap-5">
            <div className={`w-16 h-20 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-lg ${isDraft ? 'opacity-60' : ''}`}>
              <BookOpen className="w-6 h-6 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-ink-900 dark:text-white">{screenplay.title}</h1>
                <Badge color={isDraft ? 'slate' : 'forest'}>{isDraft ? 'Draft' : 'Published'}</Badge>
                {screenplay.industry_qualified && <Badge color="accent"><ShieldCheck className="w-3 h-3 mr-1" />Industry Qualified</Badge>}
              </div>
              <p className="text-ink-500 dark:text-ink-400 mb-3">{screenplay.logline}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge color="ink">{screenplay.genre}</Badge>
                {screenplay.format_type && <Badge color="slate">{screenplay.format_type}</Badge>}
                <span className="text-xs text-ink-400 dark:text-ink-500">{screenplay.page_count} pages</span>
                {screenplay.tags.map((tag) => (
                  <span key={tag} className="text-xs text-ink-400 dark:text-ink-500">#{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {isDraft ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-10 h-10 text-ink-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">This screenplay is a draft</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 max-w-md mx-auto mb-6">Publish your screenplay to assign readers and start collecting engagement data.</p>
          <PublishButton screenplayId={screenplay.id} onPublished={() => window.location.reload()} />
        </Card>
      ) : (
        <>
          {/* Industry stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Industry reads" value={industrySessions.length} sublabel="reading sessions" accent="sea" />
            <StatCard label="Intro requests" value={industryRequests.length} sublabel={`${industryRequests.filter(r => r.status === 'pending').length} pending`} accent="accent" />
            <StatCard label="Accepted" value={industryRequests.filter(r => r.status === 'approved').length} sublabel="identities revealed" accent="forest" />
            <StatCard label="Declined" value={industryRequests.filter(r => r.status === 'declined').length} sublabel="requests declined" accent="coral" />
          </div>

          {/* Lifecycle manager */}
          {screenplay.status === 'published' && (
            <ScreenplayLifecycleManager screenplay={screenplay} onUpdated={() => window.location.reload()} />
          )}

          {/* Overview stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Readers" value={totalReaders} sublabel="independent readers" accent="sea" />
            <StatCard label="Completion" value={`${completionRate}%`} sublabel={`${completedReaders} of ${totalReaders} finished`} accent="forest" />
            <StatCard label="Recommend" value={`${recommendRate}%`} sublabel={`${recommendCount} of ${feedback.length}`} accent="accent" />
            <StatCard label="Avg rating" value={avgRating} sublabel={`${feedback.length} reviews`} accent="ink" />
          </div>

          {/* Retention curve + drop-offs */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Reader retention</h2>
                  <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500">How many readers reached each page</p>
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

            {/* Confidence */}
            <Card className="p-6 flex flex-col items-center justify-center">
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Confidence score</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 mb-6 text-center">Based on reader volume, completion, and feedback</p>
              <ConfidenceGauge score={confidence.score} level={confidence.level} label={confidence.label} />
              <div className="mt-6 w-full space-y-2 text-xs">
                <div className="flex justify-between text-ink-500 dark:text-ink-400 dark:text-ink-500">
                  <span>Reader volume</span>
                  <span className="font-medium text-ink-700 dark:text-ink-200">{totalReaders} / 10+</span>
                </div>
                <div className="flex justify-between text-ink-500 dark:text-ink-400 dark:text-ink-500">
                  <span>Completion rate</span>
                  <span className="font-medium text-ink-700 dark:text-ink-200">{completionRate}%</span>
                </div>
                <div className="flex justify-between text-ink-500 dark:text-ink-400 dark:text-ink-500">
                  <span>Feedback count</span>
                  <span className="font-medium text-ink-700 dark:text-ink-200">{feedback.length}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Engagement signals */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Engagement signals</h2>
              <div className="grid grid-cols-2 gap-4">
                <SignalBox icon={Eye} label="Return rate" value={`${engagement.returnRate}%`} sub={`${engagement.returnSessions} of ${engagement.totalSessions} sessions`} />
                <SignalBox icon={Clock} label="Avg session" value={formatDuration(engagement.avgDuration)} sub={`${engagement.totalSessions} total sessions`} />
                <SignalBox icon={TrendingUp} label="Avg last page" value={`${Math.round(sessions.reduce((s, sess) => s + sess.last_page_reached, 0) / Math.max(sessions.length, 1))}`} sub={`of ${screenplay.page_count} pages`} />
                <SignalBox icon={ThumbsUp} label="Recommend" value={`${recommendRate}%`} sub={`${recommendCount} of ${feedback.length}`} />
              </div>
            </Card>

            {/* Rating breakdown */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Dimensional ratings</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500 mb-5">Average across {feedback.length} reader reviews</p>
              {avgRatings.length > 0 ? (
                <RatingBreakdown ratings={avgRatings} />
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-ink-400 dark:text-ink-500">No ratings yet</div>
              )}
            </Card>
          </div>

          {/* Reader assignments table */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Reader assignments</h2>
            <div className="space-y-2">
              {assignments.map((a) => {
                const readerSessions = sessions.filter((s) => s.assignment_id === a.id);
                const lastPage = Math.max(...readerSessions.map((s) => s.last_page_reached), 0);
                const totalDuration = readerSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
                const hasFeedback = feedback.some((f) => f.assignment_id === a.id);
                return (
                  <div key={a.id} className="flex items-center gap-4 py-3 border-b border-ink-50 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-ink-100 flex items-center justify-center text-xs font-semibold text-ink-600 dark:text-ink-300">
                      {a.reader_number ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 dark:text-white">Reader #{a.reader_number}</div>
                      <div className="text-xs text-ink-400 dark:text-ink-500">
                        {readerSessions.length} session{readerSessions.length !== 1 ? 's' : ''} · {formatDuration(totalDuration)} · reached page {lastPage}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasFeedback && <Badge color="accent">Reviewed</Badge>}
                      <Badge color={a.status === 'completed' ? 'forest' : a.status === 'abandoned' ? 'coral' : 'ink'}>
                        {a.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {assignments.length === 0 && (
                <div className="text-center py-8 text-sm text-ink-400 dark:text-ink-500">No reader assignments yet</div>
              )}
            </div>
          </Card>

          {/* Reader feedback */}
          {feedback.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Reader feedback</h2>
              <div className="space-y-4">
                {feedback.map((fb, i) => {
                  const assignment = assignments.find((a) => a.id === fb.assignment_id);
                  return (
                    <div key={fb.id} className="border-b border-ink-50 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-ink-100 flex items-center justify-center text-xs font-semibold text-ink-600 dark:text-ink-300">
                          {assignment?.reader_number ?? '?'}
                        </div>
                        <span className="text-sm font-medium text-ink-900 dark:text-white">Reader #{assignment?.reader_number}</span>
                        <div className="flex items-center gap-1">
                          {[...Array(10)].map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3 h-3 ${idx < fb.overall_rating ? 'fill-accent-400 text-accent-400' : 'text-ink-200'}`}
                            />
                          ))}
                        </div>
                        <Badge color={fb.would_recommend ? 'forest' : 'coral'}>
                          {fb.would_recommend ? 'Recommends' : 'Does not recommend'}
                        </Badge>
                        <span className="text-xs text-ink-400 dark:text-ink-500 ml-auto">{relativeTime(fb.submitted_at)}</span>
                      </div>
                      <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed pl-11">{fb.written_feedback}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SignalBox({ icon: Icon, label, value, sub }: { icon: typeof Eye; label: string; value: string; sub: string }) {
  return (
    <div className="bg-ink-50 dark:bg-ink-950 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-ink-400 dark:text-ink-500" />
        <span className="text-xs font-medium text-ink-400 dark:text-ink-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-ink-900 dark:text-white tabular-nums">{value}</div>
      <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{sub}</div>
    </div>
  );
}

function PublishButton({ screenplayId, onPublished }: { screenplayId: string; onPublished: () => void }) {
  const [publishing, setPublishing] = useState(false);
  const handlePublish = async () => {
    setPublishing(true);
    await supabase
      .from('screenplays')
      .update({ status: 'published', published_at: new Date().toISOString(), visibility: 'readers_only' })
      .eq('id', screenplayId);
    setPublishing(false);
    onPublished();
  };
  return (
    <Button onClick={handlePublish} disabled={publishing}>
      {publishing ? 'Publishing...' : 'Publish screenplay'}
      {!publishing && <ChevronRight className="w-4 h-4" />}
    </Button>
  );
}
