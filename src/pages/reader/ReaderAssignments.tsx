import { useEffect, useState } from 'react';
import { BookOpen, ArrowRight, Clock, CheckCircle2, XCircle, Play, Square, Home } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getCoverColor, relativeTime, type Assignment, type Screenplay, type ReadingSession } from '@/lib/types';

interface ReaderAssignmentsProps {
  navigate: (to: string) => void;
}

interface AssignmentWithSessions extends Assignment {
  screenplay?: Screenplay;
  sessions?: ReadingSession[];
}

export function ReaderAssignments({ navigate }: ReaderAssignmentsProps) {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithSessions[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const { data } = await supabase
        .from('assignments')
        .select('*')
        .eq('reader_id', profile.id)
        .order('assigned_at', { ascending: false });

      if (data && data.length > 0) {
        const screenplayIds = [...new Set(data.map((a: Assignment) => a.screenplay_id))];
        const [spRes, sessRes] = await Promise.all([
          supabase.from('screenplays').select('*').in('id', screenplayIds),
          supabase.from('reading_sessions').select('*').in('assignment_id', data.map((a: Assignment) => a.id)),
        ]);
        const spMap: Record<string, Screenplay> = {};
        for (const sp of (spRes.data as Screenplay[]) ?? []) spMap[sp.id] = sp;
        const sessMap: Record<string, ReadingSession[]> = {};
        for (const sess of (sessRes.data as ReadingSession[]) ?? []) {
          if (!sessMap[sess.assignment_id]) sessMap[sess.assignment_id] = [];
          sessMap[sess.assignment_id].push(sess);
        }
        setAssignments(data.map((a: Assignment) => ({
          ...a,
          screenplay: spMap[a.screenplay_id],
          sessions: sessMap[a.id] ?? [],
        })));
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading assignments...</div>;
  }

  const activeAssignments = assignments.filter((a) => a.status === 'assigned' || a.status === 'in_progress');
  const completedAssignments = assignments.filter((a) => a.status === 'completed' || a.status === 'abandoned');

  function getLastSession(sessions: ReadingSession[] | undefined): ReadingSession | null {
    if (!sessions || sessions.length === 0) return null;
    return sessions.sort((a, b) => b.session_number - a.session_number)[0];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Reading assignments</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Screenplays assigned to you. Read anonymously and provide feedback.</p>
      </div>

      {assignments.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-10 h-10 text-ink-300 dark:text-ink-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">No assignments yet</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400">When writers assign you a screenplay, it will appear here.</p>
        </Card>
      ) : (
        <>
          {/* Active */}
          {activeAssignments.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Active</h2>
              {activeAssignments.map((assignment) => {
                if (!assignment.screenplay) return null;
                const sp = assignment.screenplay;
                const colors = getCoverColor(sp.cover_color);
                const lastSession = getLastSession(assignment.sessions);
                const hasStarted = assignment.status === 'in_progress' || !!lastSession;
                const lastPage = lastSession?.last_page_reached ?? 0;

                return (
                  <Card key={assignment.id} hover className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-18 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md`}>
                        <BookOpen className="w-5 h-5 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-ink-900 dark:text-white">{sp.title}</h3>
                          <Badge color="ink">{sp.genre}</Badge>
                          {hasStarted && <Badge color="accent">In progress</Badge>}
                        </div>
                        <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-2 mb-3">{sp.logline}</p>
                        <div className="flex items-center gap-4 text-xs text-ink-400 dark:text-ink-500">
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {relativeTime(assignment.assigned_at)}</span>
                          <span>{sp.page_count} pages</span>
                          {hasStarted && lastPage > 0 && <span>Page {lastPage} reached</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button size="sm" onClick={() => navigate(`/reader/read/${assignment.id}`)}>
                          <Play className="w-3.5 h-3.5" /> {hasStarted ? 'Continue Reading' : 'Start Reading'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                        {hasStarted && (
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/reader/feedback/${assignment.id}`)}>
                            <Square className="w-3 h-3" /> Stop Reading
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Completed */}
          {completedAssignments.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Completed</h2>
              {completedAssignments.map((assignment) => {
                if (!assignment.screenplay) return null;
                const sp = assignment.screenplay;
                const colors = getCoverColor(sp.cover_color);
                return (
                  <Card key={assignment.id} className="p-5 opacity-75">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-18 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0 flex items-center justify-center shadow-md`}>
                        <BookOpen className="w-5 h-5 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-ink-900 dark:text-white">{sp.title}</h3>
                          <Badge color={assignment.status === 'completed' ? 'forest' : 'coral'}>
                            {assignment.status === 'completed' ? 'Completed' : 'Abandoned'}
                          </Badge>
                        </div>
                        <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-1">{sp.logline}</p>
                        <div className="text-xs text-ink-400 dark:text-ink-500 mt-2">
                          {assignment.completed_at ? `Completed ${relativeTime(assignment.completed_at)}` : `Assigned ${relativeTime(assignment.assigned_at)}`}
                        </div>
                      </div>
                      {assignment.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-forest-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-coral-400 flex-shrink-0" />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
