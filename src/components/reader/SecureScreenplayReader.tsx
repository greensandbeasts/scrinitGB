import { useEffect, useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ChevronLeft, ChevronRight, X, Clock, ZoomIn, ZoomOut,
  Maximize, Minimize, Shield, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/types';
import type { ReaderMode, IndustryReadingSession, Assignment, ReadingSession } from '@/lib/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface SecureScreenplayReaderProps {
  screenplayId: string;
  screenplayTitle: string;
  pageCount: number;
  coverColor: string;
  mode: ReaderMode;
  assignmentId?: string;
  onExit: () => void;
  onComplete?: () => void;
  onResume?: (page: number) => void;
}

interface WatermarkInfo {
  sessionId: string;
  timestamp: string;
  assignmentId: string | null;
  userId: string;
}

export function SecureScreenplayReader({
  screenplayId,
  screenplayTitle,
  pageCount,
  coverColor,
  mode,
  assignmentId,
  onExit,
  onComplete,
}: SecureScreenplayReaderProps) {
  const { profile } = useAuth();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(pageCount);
  const [zoom, setZoom] = useState(1.0);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStart, setSessionStart] = useState(Date.now());
  const [activeSession, setActiveSession] = useState<ReadingSession | IndustryReadingSession | null>(null);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Load PDF
  useEffect(() => {
    async function loadPdf() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Authentication required.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-screenplay?screenplayId=${screenplayId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          }
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

        // Determine resume page
        let resumePage = 1;
        if (mode === 'reader' && assignmentId) {
          const { data: sessions } = await supabase
            .from('reading_sessions')
            .select('last_page_reached')
            .eq('assignment_id', assignmentId)
            .order('session_number', { ascending: false });
          if (sessions && sessions.length > 0) {
            resumePage = Math.max(1, sessions[0].last_page_reached);
          }
        } else if (mode === 'industry') {
          const { data: sessions } = await supabase
            .from('industry_reading_sessions')
            .select('last_page_reached')
            .eq('screenplay_id', screenplayId)
            .eq('industry_user_id', profile!.id)
            .order('session_number', { ascending: false });
          if (sessions && sessions.length > 0) {
            resumePage = Math.max(1, sessions[0].last_page_reached);
          }
        }
        setCurrentPage(resumePage);
        setLoading(false);
      } catch {
        setError("Failed to load the screenplay PDF.");
        setLoading(false);
      }
    }
    loadPdf();
  }, [screenplayId, mode, assignmentId, profile]);

  // Start a session
  useEffect(() => {
    async function startSession() {
      if (!profile || loading) return;
      const start = Date.now();
      setSessionStart(start);

      if (mode === 'reader' && assignmentId) {
        // Determine session number
        const { data: existing } = await supabase
          .from('reading_sessions')
          .select('session_number')
          .eq('assignment_id', assignmentId)
          .order('session_number', { ascending: false });
        const sessionNumber = existing && existing.length > 0 ? existing[0].session_number + 1 : 1;

        const { data } = await supabase.from('reading_sessions').insert({
          assignment_id: assignmentId,
          screenplay_id: screenplayId,
          reader_id: profile.id,
          session_number: sessionNumber,
          started_at: new Date(start).toISOString(),
          last_page_reached: currentPage,
          status: 'in_progress',
        }).select('*').maybeSingle();
        setActiveSession(data as ReadingSession | null);

        // Update assignment status
        await supabase
          .from('assignments')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', assignmentId)
          .eq('status', 'assigned');
      } else if (mode === 'industry') {
        const { data: existing } = await supabase
          .from('industry_reading_sessions')
          .select('session_number')
          .eq('screenplay_id', screenplayId)
          .eq('industry_user_id', profile.id)
          .order('session_number', { ascending: false });
        const sessionNumber = existing && existing.length > 0 ? existing[0].session_number + 1 : 1;

        const { data } = await supabase.from('industry_reading_sessions').insert({
          screenplay_id: screenplayId,
          industry_user_id: profile.id,
          session_number: sessionNumber,
          started_at: new Date(start).toISOString(),
          last_page_reached: currentPage,
          status: 'in_progress',
        }).select('*').maybeSingle();
        setActiveSession(data as IndustryReadingSession | null);
      }
    }
    startSession();
  }, [profile, loading, mode, assignmentId, screenplayId]);

  // Render current page
  useEffect(() => {
    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoom * 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch {
        // Render error - non-fatal
      }
      setRendering(false);
    }
    renderPage();
  }, [pdfDoc, currentPage, zoom]);

  // Track page changes
  const trackPageChange = useCallback(async (page: number) => {
    if (!activeSession || !profile) return;
    if (mode === 'reader') {
      await supabase.from('reading_sessions').update({
        last_page_reached: page,
        pages_read_this_session: page - (activeSession as ReadingSession).last_page_reached + (activeSession as ReadingSession).pages_read_this_session,
      }).eq('id', activeSession.id);
    } else {
      await supabase.from('industry_reading_sessions').update({
        last_page_reached: page,
        pages_read_this_session: page - (activeSession as IndustryReadingSession).last_page_reached + (activeSession as IndustryReadingSession).pages_read_this_session,
      }).eq('id', activeSession.id);
    }
  }, [activeSession, profile, mode]);

  // End session
  const endSession = useCallback(async (status: 'completed' | 'abandoned') => {
    if (!activeSession || !profile) return;
    const duration = Math.round((Date.now() - sessionStart) / 1000);
    if (mode === 'reader') {
      const s = activeSession as ReadingSession;
      await supabase.from('reading_sessions').update({
        ended_at: new Date().toISOString(),
        last_page_reached: currentPage,
        duration_seconds: duration,
        status,
        decision: status === 'completed' ? 'continue' : 'stop',
      }).eq('id', s.id);
    } else {
      const s = activeSession as IndustryReadingSession;
      await supabase.from('industry_reading_sessions').update({
        ended_at: new Date().toISOString(),
        last_page_reached: currentPage,
        duration_seconds: duration,
        status,
      }).eq('id', s.id);
    }
  }, [activeSession, profile, mode, sessionStart, currentPage]);

  const handleNextPage = async () => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      await trackPageChange(next);
    } else {
      // Reached the end
      await endSession('completed');
      onComplete?.();
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      handleNextPage();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrevPage();
    } else if (e.key === 'Escape') {
      onExit();
    } else if (e.key === '+' || e.key === '=') {
      setZoom(z => Math.min(z + 0.25, 3));
    } else if (e.key === '-') {
      setZoom(z => Math.max(z - 0.25, 0.5));
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Cleanup on exit
  const handleExit = async () => {
    await endSession('abandoned');
    onExit();
  };

  // Watermark info
  const watermarkInfo: WatermarkInfo = {
    sessionId: sessionIdRef.current,
    timestamp: new Date().toISOString(),
    assignmentId: assignmentId ?? null,
    userId: profile?.id ?? '',
  };

  const progress = totalPages > 0 ? ((currentPage) / totalPages) * 100 : 0;
  const elapsedSeconds = Math.round((Date.now() - sessionStart) / 1000);

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
          <button onClick={onExit} className="px-6 py-2.5 rounded-xl bg-ink-900 dark:bg-ink-100 text-white dark:text-ink-950 font-medium text-sm">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`fixed inset-0 z-50 bg-ink-100 dark:bg-ink-950 flex flex-col ${fullscreen ? '' : ''}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={handleExit} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors flex-shrink-0">
            <X className="w-5 h-5 text-ink-500 dark:text-ink-400" />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-900 dark:text-white truncate">{screenplayTitle}</div>
            <div className="text-xs text-ink-400 dark:text-ink-500">
              {mode === 'industry' ? 'Industry reading' : 'Reader assignment'} · Page {currentPage} of {totalPages}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4 text-ink-500 dark:text-ink-400" />
          </button>
          <span className="text-xs text-ink-400 dark:text-ink-500 tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4 text-ink-500 dark:text-ink-400" />
          </button>
          <div className="w-px h-5 bg-ink-200 dark:bg-ink-700 mx-1" />
          {/* Fullscreen toggle */}
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" title="Fullscreen">
            {fullscreen ? <Minimize className="w-4 h-4 text-ink-500 dark:text-ink-400" /> : <Maximize className="w-4 h-4 text-ink-500 dark:text-ink-400" />}
          </button>
          <div className="w-px h-5 bg-ink-200 dark:bg-ink-700 mx-1" />
          {/* Timer */}
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

      {/* PDF canvas area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 lg:p-8 bg-ink-100 dark:bg-ink-950 relative">
        {/* Watermark overlay */}
        <div
          ref={watermarkRef}
          className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            className="text-ink-300 dark:text-ink-700 text-[10px] font-mono opacity-[0.06] select-none whitespace-nowrap"
            style={{ transform: 'rotate(-30deg)' }}
          >
            SCRINIT · {watermarkInfo.sessionId.slice(0, 8)} · {watermarkInfo.userId.slice(0, 8)} · {new Date(watermarkInfo.timestamp).toISOString().slice(0, 16)}
            {watermarkInfo.assignmentId && ` · ${watermarkInfo.assignmentId.slice(0, 8)}`}
          </div>
        </div>

        {rendering && (
          <div className="absolute top-4 right-4 z-20">
            <Loader2 className="w-5 h-5 text-ink-300 dark:text-ink-600 animate-spin" />
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="shadow-xl rounded-sm bg-white dark:bg-ink-900"
          style={{ maxWidth: '100%' }}
        />
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800 shadow-sm">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        <div className="flex items-center gap-2">
          {/* Page indicator dots */}
          <div className="hidden sm:flex items-center gap-1">
            {totalPages <= 20 ? (
              Array.from({ length: totalPages }, (_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i + 1 === currentPage ? 'bg-accent-500 w-3' : 'bg-ink-200 dark:bg-ink-700'}`}
                />
              ))
            ) : (
              <span className="text-xs text-ink-400 dark:text-ink-500 tabular-nums">{currentPage} / {totalPages}</span>
            )}
          </div>
        </div>

        <button
          onClick={handleNextPage}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-ink-900 dark:bg-ink-100 text-white dark:text-ink-950 hover:bg-ink-800 dark:hover:bg-white transition-colors"
        >
          {currentPage >= totalPages ? 'Finish' : 'Next'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Security notice */}
      <div className="px-4 py-1.5 bg-ink-900 dark:bg-ink-900 text-ink-500 text-[10px] flex items-center justify-center gap-2">
        <Shield className="w-3 h-3" />
        <span>Protected by Scrinit Secure Reader · No downloads permitted · Watermarked for traceability</span>
      </div>
    </div>
  );
}
