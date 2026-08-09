import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Users, TrendingUp, Star, Shield, Eye, Pause, Play, Trash2, AlertCircle, Check, Loader2, Building2, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getCoverColor, relativeTime, formatDuration, type Screenplay, type ReadingSession, type ReaderFeedback, type Assignment, type IndustryRequest, type IndustryReadingSession, type Profile } from '@/lib/types';
import { computeRetentionCurve, computeDropOffPoints, computeEngagementSummary, computeConfidenceScore } from '@/lib/analytics';
import { RetentionCurve } from '@/components/charts/RetentionCurve';
import { ConfidenceGauge } from '@/components/charts/ConfidenceGauge';
import { RatingBreakdown } from '@/components/charts/RatingBreakdown';

interface AdminScreenplayDetailProps {
  screenplayId: string;
  navigate: (to: string) => void;
}

export function AdminScreenplayDetail({ screenplayId, navigate }: AdminScreenplayDetailProps) {
  const [screenplay, setScreenplay] = useState<Screenplay | null>(null);
  const [writer, setWriter] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [feedback, setFeedback] = useState<ReaderFeedback[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & { reader_name?: string })[]>([]);
  const [industryRequests, setIndustryRequests] = useState<IndustryRequest[]>([]);
  const [industrySessions, setIndustrySessions] = useState<IndustryReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

      if (spRes.data) {
        const { data: writerData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', (spRes.data as Screenplay).writer_id)
          .maybeSingle();
        setWriter(writerData as Profile | null);
      }

      setLoading(false);
    }
    load();
  }, [screenplayId]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const toggleAssignmentPause = async () => {
    if (!screenplay) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('screenplays')
      .update({ assignment_paused: !screenplay.assignment_paused })
      .eq('id', screenplay.id);
    setActionLoading(false);
    if (error) {
      showMessage('error', error.message);
    } else {
      setScreenplay({ ...screenplay, assignment_paused: !screenplay.assignment_paused });
      showMessage('success', `Assignments ${screenplay.assignment_paused ? 'resumed' : 'paused'}`);
    }
  };

  const toggleIndustryQualified = async () => {
    if (!screenplay) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('screenplays')
      .update({ industry_qualified: !screenplay.industry_qualified })
      .eq('id', screenplay.id);
    setActionLoading(false);
    if (error) {
      showMessage('error', error.message);
    } else {
      setScreenplay({ ...screenplay, industry_qualified: !screenplay.industry_qualified });
      showMessage('success', `Industry qualification ${screenplay.industry_qualified ? 'revoked' : 'granted'}`);
    }
  };

  const toggleVisibility = async () => {
    if (!screenplay) return;
    const newVisibility = screenplay.visibility === 'private' ? 'readers_only' : 'private';
    setActionLoading(true);
    const { error } = await supabase
      .from('screenplays')
      .update({ visibility: newVisibility })
      .eq('id', screenplay.id);
    setActionLoading(false);
    if (error) {
      showMessage('error', error.message);
    } else {
      setScreenplay({ ...screenplay, visibility: newVisibility });
      showMessage('success', `Visibility changed to ${newVisibility.replace('_', ' ')}`);
    }
  };

  const deleteScreenplay = async () => {
    if (!screenplay) return;
    if (!confirm(`Delete "${screenplay.title}"? This will remove all assignments, feedback, and reading sessions. This cannot be undone.`)) return;
    setActionLoading(true);
    const { error } = await supabase.from('screenplays').delete().eq('id', screenplay.id);
    setActionLoading(false);
    if (error) {
      showMessage('error', error.message);
    } else {
      navigate('/admin/screenplays');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading screenplay...</div>;
  }

  if (!screenplay) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 dark:text-ink-400 mb-4">Screenplay not found.</p>
        <Button variant="secondary" onClick={() => navigate('/admin/screenplays')}>Back to screenplays</Button>
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
      <button onClick={() => navigate('/admin/screenplays')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to screenplays
      </button>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in ${
          message.type === 'success'
            ? 'bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 text-forest-700 dark:text-forest-400'
            : 'bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Header with moderation controls */}
      <Card className="overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${colors.gradient}`} />
        <div className="p-6">
          <div className="flex items-start gap-5 mb-4">
            <div className={`w-16 h-20 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-lg ${isDraft ? 'opacity-60' : ''}`}>
              <BookOpen className="w-6 h-6 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold text-ink-900 dark:text-white">{screenplay.title}</h1>
                <Badge color={isDraft ? 'slate' : 'forest'}>{isDraft ? 'Draft' : 'Published'}</Badge>
                <Badge color="ink">{screenplay.visibility.replace('_', ' ')}</Badge>
                {screenplay.industry_qualified && <Badge color="accent"><ShieldCheck className="w-3 h-3 mr-1" />Qualified</Badge>}
                {screenplay.assignment_paused && <Badge color="coral"><Pause className="w-3 h-3 mr-1" />Paused</Badge>}
              </div>
              <p className="text-ink-500 dark:text-ink-400 mb-3">{screenplay.logline}</p>
              <div className="flex items-center gap-3 flex-wrap text-xs text-ink-400 dark:text-ink-500">
                <Badge color="ink">{screenplay.genre}</Badge>
                {screenplay.format_type && <Badge color="slate">{screenplay.format_type}</Badge>}
                <span>{screenplay.page_count} pages</span>
                <span>Created {relativeTime(screenplay.created_at)}</span>
                {writer && (
                  <button
                    onClick={() => navigate(`/admin/users`)}
                    className="flex items-center gap-1 text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white"
                  >
                    by {writer.display_name}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Moderation controls */}
          {!isDraft && (
            <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-ink-100 dark:border-ink-800">
              <Button size="sm" variant="secondary" onClick={toggleAssignmentPause} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                  screenplay.assignment_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {screenplay.assignment_paused ? 'Resume assignments' : 'Pause assignments'}
              </Button>
              <Button size="sm" variant="secondary" onClick={toggleIndustryQualified} disabled={actionLoading}>
                <Shield className="w-3.5 h-3.5" />
                {screenplay.industry_qualified ? 'Revoke qualification' : 'Mark industry qualified'}
              </Button>
              <Button size="sm" variant="secondary" onClick={toggleVisibility} disabled={actionLoading}>
                <Eye className="w-3.5 h-3.5" />
                {screenplay.visibility === 'private' ? 'Make visible to readers' : 'Make private'}
              </Button>
              <Button size="sm" variant="danger" onClick={deleteScreenplay} disabled={actionLoading}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete screenplay
              </Button>
            </div>
          )}
        </div>
      </Card>

      {!isDraft && (
        <>
          {/* Writer info */}
          {writer && (
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-ink-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink-900 dark:text-white">{writer.display_name}</div>
                  <div className="text-xs text-ink-400 dark:text-ink-500">{writer.email} · {writer.company ?? 'No company'}</div>
                </div>
                <Badge color={writer.suspended ? 'coral' : 'forest'}>{writer.suspended ? 'Suspended' : 'Active'}</Badge>
              </div>
            </Card>
          )}

          {/* Overview stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Readers" value={totalReaders} sublabel="independent readers" accent="sea" />
            <StatCard label="Completion" value={`${completionRate}%`} sublabel={`${completedReaders} of ${totalReaders} finished`} accent="forest" />
            <StatCard label="Recommend" value={`${recommendRate}%`} sublabel={`${recommendCount} of ${feedback.length}`} accent="accent" />
            <StatCard label="Avg rating" value={avgRating} sublabel={`${feedback.length} reviews`} accent="ink" />
          </div>

          {/* Industry stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Industry reads" value={industrySessions.length} sublabel="reading sessions" accent="sea" />
            <StatCard label="Intro requests" value={industryRequests.length} sublabel={`${industryRequests.filter(r => r.status === 'pending').length} pending`} accent="accent" />
            <StatCard label="Accepted" value={industryRequests.filter(r => r.status === 'approved').length} sublabel="identities revealed" accent="forest" />
            <StatCard label="Declined" value={industryRequests.filter(r => r.status === 'declined').length} sublabel="requests declined" accent="coral" />
          </div>

          {/* Retention + confidence */}
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
            </Card>
            <Card className="p-6 flex flex-col items-center justify-center">
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Confidence score</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400 mb-6 text-center">Based on reader volume, completion, and feedback</p>
              <ConfidenceGauge score={confidence.score} level={confidence.level} label={confidence.label} />
            </Card>
          </div>

          {/* Rating breakdown */}
          {avgRatings.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-5">Dimensional ratings</h2>
              <RatingBreakdown ratings={avgRatings} />
            </Card>
          )}

          {/* Assignments table */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Reader assignments ({assignments.length})</h2>
            <div className="space-y-2">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-4 py-3 border-b border-ink-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-xs font-semibold text-ink-600 dark:text-ink-300">
                    {a.reader_number ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 dark:text-white">Reader #{a.reader_number}</div>
                    <div className="text-xs text-ink-400 dark:text-ink-500">
                      Assigned {relativeTime(a.assigned_at)} · {a.status}
                    </div>
                  </div>
                  <Badge color={a.status === 'completed' ? 'forest' : a.status === 'abandoned' ? 'coral' : 'ink'}>
                    {a.status}
                  </Badge>
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="text-center py-8 text-sm text-ink-400 dark:text-ink-500">No reader assignments</div>
              )}
            </div>
          </Card>

          {/* Feedback */}
          {feedback.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Reader feedback ({feedback.length})</h2>
              <div className="space-y-4">
                {feedback.map((fb) => {
                  const assignment = assignments.find((a) => a.id === fb.assignment_id);
                  return (
                    <div key={fb.id} className="border-b border-ink-50 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-ink-900 dark:text-white">Reader #{assignment?.reader_number}</span>
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
                      {fb.written_feedback && (
                        <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed pl-11">{fb.written_feedback}</p>
                      )}
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
