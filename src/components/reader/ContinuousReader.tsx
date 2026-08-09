import { useEffect, useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.min.mjs?url';
import {
  X, Clock, ZoomIn, ZoomOut, Shield, Loader2,
  Play, Pause, Home, ChevronUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/types';
import type { ReaderMode, IndustryReadingSession, ReadingSession } from '@/lib/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface ContinuousReaderProps {
  screenplayId: string;
  screenplayTitle: string;
  pageCount: number;
  coverColor: string;
  mode: ReaderMode;
  assignmentId?: string;
  onReturnLater: (sessionData: { scrollPosition: number; pagesRead: number; activeReadingSeconds: number; lastPageReached: number }) => void;
  onStopReading: (sessionData: { scrollPosition: number; pagesRead: number; activeReadingSeconds: number; lastPageReached: number }) => void;
  onLeaveReader: () => void;
}

interface WatermarkInfo {
  sessionId: string;
  timestamp: string;
  assignmentId: string | null;
  userId: string;
}

const INACTIVITY_TIMEOUT_DEFAULT = 180;

export function ContinuousReader({
  screenplayId,
  screenplayTitle,
  pageCount,
  mode,
  assignmentId,
  onReturnLater,
  onStopReading,
  onLeaveReader,
}: ContinuousReaderProps) {
  const { profile } = useAuth();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStart] = useState(Date.now());
  const [activeSession, setActiveSession] = useState<ReadingSession | IndustryReadingSession | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(pageCount);
  const [paused, setPaused] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(INACTIVITY_TIMEOUT_DEFAULT);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const activeReadingSecondsRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const activityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedScrollRef = useRef(0);
  const resumeScrollRef = useRef<number | null>(null);
  const sessionSavedRef = useRef(false);

  // Load PDF + config
  useEffect(() => {
    async function loadPdf() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setError("Authentication required."); setLoading(false); return; }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-screenplay?screenplayId=${screenplayId}`,
          { headers: { Authorization: `Bearer ${session.access_token}`, Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
        );
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Failed to load PDF" }));
          setError(errData.error || "Failed to load screenplay.");
          setLoading(false);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);

        // Get inactivity timeout from algorithm config
        const { data: configData } = await supabase.rpc('get_algorithm_config');
        if (configData) {
          setInactivityTimeout(configData.inactivity_timeout_seconds || INACTIVITY_TIMEOUT_DEFAULT);
        }

        // Determine resume scroll position
        if (mode === 'reader' && assignmentId) {
          const { data: sessions } = await supabase
            .from('reading_sessions')
            .select('last_page_reached, scroll_position')
            .eq('assignment_id', assignmentId)
            .order('session_number', { ascending: false });
          if (sessions && sessions.length > 0) {
            const lastSession = sessions[0] as ReadingSession;
            resumeScrollRef.current = lastSession.scroll_position ?? null;
            setCurrentPage(lastSession.last_page_reached);
          }
        }
        setLoading(false);
      } catch {
        setError("Failed to load the screenplay PDF.");
        setLoading(false);
      }
    }
    loadPdf();
  }, [screenplayId, mode, assignmentId]);

  // Start session
  useEffect(() => {
    async function startSession() {
      if (!profile || loading) return;

      const { data: configData } = await supabase.rpc('get_algorithm_config');
      const versionId = configData?.id ?? null;

      if (mode === 'reader' && assignmentId) {
        const { data: existing } = await supabase
          .from('reading_sessions')
          .select('session_number')
          .eq('assignment_id', assignmentId)
          .order('session_number', { ascending: false });
        const sessionNumber = existing && existing.length > 0 ? (existing[0] as { session_number: number }).session_number + 1 : 1;

        const { data } = await supabase.from('reading_sessions').insert({
          assignment_id: assignmentId,
          screenplay_id: screenplayId,
          reader_id: profile.id,
          session_number: sessionNumber,
          started_at: new Date(sessionStart).toISOString(),
          last_page_reached: currentPage,
          status: 'in_progress',
          active_reading_seconds: 0,
          scroll_position: 0,
          algorithm_version_id: versionId,
        }).select('*').maybeSingle();
        setActiveSession(data as ReadingSession | null);

        await supabase.from('assignments')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', assignmentId).eq('status', 'assigned');
      } else if (mode === 'industry') {
        const { data: existing } = await supabase
          .from('industry_reading_sessions')
          .select('session_number')
          .eq('screenplay_id', screenplayId)
          .eq('industry_user_id', profile.id)
          .order('session_number', { ascending: false });
        const sessionNumber = existing && existing.length > 0 ? (existing[0] as { session_number: number }).session_number + 1 : 1;

        const { data } = await supabase.from('industry_reading_sessions').insert({
          screenplay_id: screenplayId,
          industry_user_id: profile.id,
          session_number: sessionNumber,
          started_at: new Date(sessionStart).toISOString(),
          last_page_reached: currentPage,
          status: 'in_progress',
        }).select('*').maybeSingle();
        setActiveSession(data as IndustryReadingSession | null);
      }
    }
    startSession();
  }, [profile, loading, mode, assignmentId, screenplayId, sessionStart, currentPage]);

  // Activity tracking
  const recordActivity = useCallback(() => {
    if (paused) return;
    lastActivityRef.current = Date.now();
  }, [paused]);

  // Active reading time counter
  useEffect(() => {
    if (paused) {
      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
      return;
    }
    activityTimerRef.current = setInterval(() => {
      activeReadingSecondsRef.current += 1;
    }, 1000);
    return () => { if (activityTimerRef.current) clearInterval(activityTimerRef.current); };
  }, [paused]);

  // Inactivity detection
  useEffect(() => {
    if (paused) return;
    inactivityTimerRef.current = setInterval(() => {
      const idleSeconds = (Date.now() - lastActivityRef.current) / 1000;
      if (idleSeconds >= inactivityTimeout) {
        setPaused(true);
      }
    }, 5000);
    return () => { if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current); };
  }, [paused, inactivityTimeout]);

  // Activity event listeners
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const events = ['scroll', 'mousemove', 'click', 'keydown', 'touchstart', 'wheel'];
    const handler = () => recordActivity();
    events.forEach(e => container.addEventListener(e, handler, { passive: true }));
    window.addEventListener('keydown', handler);
    return () => {
      events.forEach(e => container.removeEventListener(e, handler));
      window.removeEventListener('keydown', handler);
    };
  }, [recordActivity]);

  // Render visible pages
  useEffect(() => {
    if (!pdfDoc || loading) return;
    const renderPage = async (pageNum: number) => {
      if (!pdfDoc) return;
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas || canvas.dataset.rendered === 'true') return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: zoom * 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;
        const context = canvas.getContext('2d');
        if (!context) return;
        await page.render({ canvasContext: context, viewport }).promise;
        canvas.dataset.rendered = 'true';
      } catch {
        // non-fatal
      }
    };

    // Render pages near current page
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 3);
    for (let p = start; p <= end; p++) {
      renderPage(p);
    }
  }, [pdfDoc, currentPage, zoom, loading, totalPages]);

  // Scroll handler — determine current page and save scroll position
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    recordActivity();

    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    // Determine which page is most visible
    let bestPage = 1;
    let bestVisibility = 0;
    canvasRefs.current.forEach((canvas, pageNum) => {
      const rect = canvas.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, containerHeight);
      const visible = Math.max(0, visibleBottom - visibleTop);
      if (visible > bestVisibility) {
        bestVisibility = visible;
        bestPage = pageNum;
      }
    });

    if (bestPage !== currentPage) {
      setCurrentPage(bestPage);
    }

    // Save scroll position periodically (every 100px of scroll change)
    if (Math.abs(scrollTop - lastSavedScrollRef.current) > 100) {
      lastSavedScrollRef.current = scrollTop;
      if (activeSession && mode === 'reader') {
        supabase.from('reading_sessions').update({
          scroll_position: scrollTop,
          last_page_reached: bestPage,
          active_reading_seconds: activeReadingSecondsRef.current,
        }).eq('id', activeSession.id).then(() => {});
      }
    }
  }, [recordActivity, activeSession, mode, currentPage]);

  // Restore scroll position after pages render
  useEffect(() => {
    if (loading || !pdfDoc || resumeScrollRef.current === null) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const restoreScroll = () => {
      if (resumeScrollRef.current !== null) {
        container.scrollTop = resumeScrollRef.current;
        resumeScrollRef.current = null;
      }
    };
    // Wait a tick for canvases to render
    setTimeout(restoreScroll, 200);
  }, [loading, pdfDoc]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') { setZoom(z => Math.min(z + 0.25, 3)); }
      else if (e.key === '-') { setZoom(z => Math.max(z - 0.25, 0.5)); }
      else if (e.key === 'Escape') { setShowLeavePrompt(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // beforeunload handler
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!sessionSavedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // PopState handler
  useEffect(() => {
    const handler = () => {
      if (!sessionSavedRef.current) {
        setShowLeavePrompt(true);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const getSessionData = useCallback(() => {
    const container = scrollContainerRef.current;
    return {
      scrollPosition: container?.scrollTop ?? 0,
      pagesRead: currentPage,
      activeReadingSeconds: activeReadingSecondsRef.current,
      lastPageReached: currentPage,
    };
  }, [currentPage]);

  const saveSession = useCallback(async (status: 'completed' | 'abandoned', decision: 'continue' | 'stop', stopReason?: string) => {
    if (!activeSession || sessionSavedRef.current) return;
    sessionSavedRef.current = true;
    const duration = Math.round((Date.now() - sessionStart) / 1000);
    const data = getSessionData();

    if (mode === 'reader') {
      await supabase.from('reading_sessions').update({
        ended_at: new Date().toISOString(),
        last_page_reached: data.lastPageReached,
        pages_read_this_session: data.pagesRead,
        duration_seconds: duration,
        active_reading_seconds: data.activeReadingSeconds,
        scroll_position: data.scrollPosition,
        status,
        decision,
        stop_reason: stopReason ?? null,
      }).eq('id', (activeSession as ReadingSession).id);
    } else {
      await supabase.from('industry_reading_sessions').update({
        ended_at: new Date().toISOString(),
        last_page_reached: data.lastPageReached,
        pages_read_this_session: data.pagesRead,
        duration_seconds: duration,
        status,
      }).eq('id', (activeSession as IndustryReadingSession).id);
    }
  }, [activeSession, sessionStart, mode, getSessionData]);

  const handleReturnLater = useCallback(async () => {
    await saveSession('abandoned', 'continue');
    onReturnLater(getSessionData());
  }, [saveSession, onReturnLater, getSessionData]);

  const handleStopReading = useCallback(async () => {
    await saveSession('abandoned', 'stop');
    onStopReading(getSessionData());
  }, [saveSession, onStopReading, getSessionData]);

  const handleContinueReading = useCallback(() => {
    setPaused(false);
    lastActivityRef.current = Date.now();
  }, []);

  const handleLeaveConfirm = useCallback(async () => {
    await saveSession('abandoned', 'stop');
    onLeaveReader();
  }, [saveSession, onLeaveReader]);

  const handleScrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const watermarkInfo: WatermarkInfo = {
    sessionId: sessionIdRef.current,
    timestamp: new Date().toISOString(),
    assignmentId: assignmentId ?? null,
    userId: profile?.id ?? '',
  };

  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
  const elapsedSeconds = Math.round((Date.now() - sessionStart) / 1000);
  const reachedPage3 = currentPage >= 3;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-ink-50 dark:bg-ink-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-ink-300 dark:text-ink-600 animate-spin mx-auto mb-4" />
          <p className="text-sm text-ink-500 dark:text-ink-400">Loading secure screenplay...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-ink-50 dark:bg-ink-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-coral-50 dark:bg-coral-900/20 flex items-center justify-center mx-auto mb-4">
            <X className="w-7 h-7 text-coral-600 dark:text-coral-400" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">Cannot load screenplay</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">{error}</p>
          <button onClick={onLeaveReader} className="px-6 py-2.5 rounded-xl bg-ink-900 dark:bg-ink-100 text-white dark:text-ink-950 font-medium text-sm">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-100 dark:bg-ink-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setShowLeavePrompt(true)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors flex-shrink-0">
            <X className="w-5 h-5 text-ink-500 dark:text-ink-400" />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-900 dark:text-white truncate">{screenplayTitle}</div>
            <div className="text-xs text-ink-400 dark:text-ink-500">Page {currentPage} of {totalPages}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4 text-ink-500 dark:text-ink-400" />
          </button>
          <span className="text-xs text-ink-400 dark:text-ink-500 tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4 text-ink-500 dark:text-ink-400" />
          </button>
          <div className="w-px h-5 bg-ink-200 dark:bg-ink-700 mx-1" />
          <div className="flex items-center gap-1.5 text-sm text-ink-400 dark:text-ink-500">
            <Clock className="w-4 h-4" />
            <span className="font-mono tabular-nums">{formatDuration(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-ink-200 dark:bg-ink-800">
        <div className="h-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Action bar — appears after page 3 */}
      {reachedPage3 && !paused && (
        <div className="flex items-center justify-center gap-3 py-2 bg-ink-50 dark:bg-ink-900 border-b border-ink-100 dark:border-ink-800 animate-slide-down">
          <button onClick={handleReturnLater} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors">
            <Home className="w-3.5 h-3.5" /> Return Later
          </button>
          <button onClick={handleStopReading} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-coral-600 text-white hover:bg-coral-700 transition-colors">
            <Pause className="w-3.5 h-3.5" /> Stop Reading
          </button>
        </div>
      )}

      {/* Continuous scroll area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-ink-100 dark:bg-ink-950 relative"
      >
        {/* Watermark */}
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center" aria-hidden="true">
          <div className="text-ink-300 dark:text-ink-700 text-[10px] font-mono opacity-[0.06] select-none whitespace-nowrap" style={{ transform: 'rotate(-30deg)' }}>
            SCRINIT · {watermarkInfo.sessionId.slice(0, 8)} · {watermarkInfo.userId.slice(0, 8)} · {new Date(watermarkInfo.timestamp).toISOString().slice(0, 16)}
            {watermarkInfo.assignmentId && ` · ${watermarkInfo.assignmentId.slice(0, 8)}`}
          </div>
        </div>

        {/* Pages */}
        <div className="flex flex-col items-center py-6 gap-4 min-h-full">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <canvas
              key={pageNum}
              ref={(el) => { if (el) canvasRefs.current.set(pageNum, el); }}
              className="shadow-xl rounded-sm bg-white dark:bg-ink-900"
              style={{ maxWidth: '100%' }}
              data-rendered="false"
            />
          ))}
          {/* Bottom spacer */}
          <div className="h-32" />
        </div>

        {/* Scroll to top button */}
        {currentPage > 3 && (
          <button
            onClick={handleScrollToTop}
            className="fixed bottom-20 right-6 z-20 p-2.5 rounded-full bg-white dark:bg-ink-800 shadow-lg border border-ink-200 dark:border-ink-700 hover:scale-110 transition-transform"
            title="Back to top"
          >
            <ChevronUp className="w-5 h-5 text-ink-500 dark:text-ink-400" />
          </button>
        )}
      </div>

      {/* Security notice */}
      <div className="px-4 py-1.5 bg-ink-900 dark:bg-ink-900 text-ink-500 text-[10px] flex items-center justify-center gap-2">
        <Shield className="w-3 h-3" />
        <span>Protected by Scrinit Secure Reader · Watermarked for traceability</span>
      </div>

      {/* Inactivity pause overlay */}
      {paused && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center mx-auto mb-4">
              <Pause className="w-7 h-7 text-accent-600 dark:text-accent-400" />
            </div>
            <h2 className="text-lg font-bold text-ink-900 dark:text-white mb-2">Reading Paused</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">Your reading session has been paused due to inactivity.</p>
            <button onClick={handleContinueReading} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-ink-900 dark:bg-ink-100 text-white dark:text-ink-950 font-medium text-sm mx-auto hover:opacity-90 transition-opacity">
              <Play className="w-4 h-4" /> Continue Reading
            </button>
          </div>
        </div>
      )}

      {/* Leave prompt */}
      {showLeavePrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <h2 className="text-lg font-bold text-ink-900 dark:text-white mb-2">This screenplay will remain in your Assigned Reading list</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">until you either Continue Reading or choose Stop Reading.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setShowLeavePrompt(false)} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-ink-900 dark:bg-ink-100 text-white dark:text-ink-950 font-medium text-sm hover:opacity-90 transition-opacity">
                <Play className="w-4 h-4" /> Continue Reading
              </button>
              <button onClick={handleLeaveConfirm} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-ink-500 dark:text-ink-400 font-medium text-sm hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors">
                <Home className="w-4 h-4" /> Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
