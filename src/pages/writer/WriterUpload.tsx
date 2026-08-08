import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft, Upload, FileText, Check, AlertCircle, Loader2,
  X, FileUp, ShieldCheck, BookOpen, Award, Gift, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ReaderContributionBalance, ContributionAlgorithmVersion } from '@/lib/types';

interface WriterUploadProps {
  navigate: (to: string) => void;
}

interface ProcessResult {
  success: boolean;
  screenplayId?: string;
  pageCount?: number;
  error?: string;
}

type Phase = 'upload' | 'processing' | 'error';

const STAGES = ['Upload', 'Metadata', 'Complete'] as const;

function StageIndicator({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STAGES.map((stage, idx) => (
        <div key={stage} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 ${idx <= currentStage ? 'text-ink-900 dark:text-white' : 'text-ink-300 dark:text-ink-600'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              idx < currentStage
                ? 'bg-forest-500 text-white'
                : idx === currentStage
                ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-400 dark:text-ink-500'
            }`}>
              {idx < currentStage ? <Check className="w-4 h-4" /> : idx + 1}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{stage}</span>
          </div>
          {idx < STAGES.length - 1 && (
            <div className={`w-8 sm:w-16 h-0.5 rounded-full transition-all ${idx < currentStage ? 'bg-forest-500' : 'bg-ink-200 dark:bg-ink-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function WriterUpload({ navigate }: WriterUploadProps) {
  const { profile, userRoles, enableRole, switchRole, refreshProfile } = useAuth();
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEligibility, setShowEligibility] = useState(false);

  const [balance, setBalance] = useState<ReaderContributionBalance | null>(null);
  const [config, setConfig] = useState<ContributionAlgorithmVersion | null>(null);
  const [eligibility, setEligibility] = useState<'free' | 'earned' | 'none' | null>(null);
  const [creditLoading, setCreditLoading] = useState(true);
  const [creatingReader, setCreatingReader] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const hasReaderRole = userRoles.includes('reader');

  const loadCreditStatus = useCallback(async () => {
    if (!profile) return;
    const [eligRes, balRes, cfgRes] = await Promise.all([
      supabase.rpc('check_upload_eligibility', { p_user_id: profile.id }),
      supabase.rpc('get_or_create_balance', { p_reader_id: profile.id }),
      supabase.rpc('get_algorithm_config'),
    ]);
    setEligibility((eligRes.data as 'free' | 'earned' | 'none') ?? 'none');
    setBalance((balRes.data as unknown as ReaderContributionBalance) ?? null);
    setConfig(cfgRes.data as ContributionAlgorithmVersion | null);
    setCreditLoading(false);
  }, [profile]);

  useEffect(() => {
    loadCreditStatus();
  }, [loadCreditStatus]);

  useEffect(() => {
    if (!profile || eligibility !== 'none') return;
    const interval = setInterval(loadCreditStatus, 10000);
    return () => clearInterval(interval);
  }, [profile, eligibility, loadCreditStatus]);

  const hasCredits = eligibility === 'free' || eligibility === 'earned';

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    if (!profile) return;

    const { data: elig } = await supabase.rpc('check_upload_eligibility', { p_user_id: profile.id });
    if (elig === 'none') {
      setPhase('upload');
      setErrorMessage('No upload credits available.');
      await loadCreditStatus();
      return;
    }

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setPhase('error');
      setErrorMessage('Only PDF files are accepted. Please upload a .pdf file.');
      return;
    }

    const maxSize = 25 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setPhase('error');
      setErrorMessage(`File exceeds the 25MB limit. Your file is ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }

    setPhase('processing');
    setUploadProgress(20);

    const filePath = `${profile.id}/${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    try {
      setUploadProgress(40);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPhase('error');
        setErrorMessage('Authentication required.');
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('path', filePath);

      setUploadProgress(60);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: formData,
        }
      );

      setUploadProgress(90);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Processing failed' }));
        setPhase('error');
        setErrorMessage(errData.error || 'Failed to process the file.');
        return;
      }

      const result: ProcessResult = await response.json();
      setUploadProgress(100);

      if (!result.success) {
        setPhase('error');
        setErrorMessage(result.error || 'Validation failed.');
        return;
      }

      await loadCreditStatus();

      if (result.screenplayId) {
        navigate(`/writer/metadata/${result.screenplayId}`);
      } else {
        navigate('/writer/screenplays');
      }
    } catch {
      setPhase('error');
      setErrorMessage('An unexpected error occurred while processing your file.');
    }
  };

  if (phase === 'processing') {
    return (
      <div className="max-w-3xl mx-auto">
        <StageIndicator currentStage={0} />
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-ink-400 dark:text-ink-500 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-2">Uploading your screenplay</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-8">
            {file?.name} · {(file ? file.size / 1024 / 1024 : 0).toFixed(1)}MB
          </p>
          <div className="max-w-sm mx-auto">
            <div className="h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-500" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="mt-3 text-xs text-ink-400 dark:text-ink-500 flex items-center justify-center gap-2">
              {uploadProgress < 50 && <><Upload className="w-3 h-3" /> Uploading file...</>}
              {uploadProgress >= 50 && uploadProgress < 90 && <><FileText className="w-3 h-3" /> Validating PDF...</>}
              {uploadProgress >= 90 && uploadProgress < 100 && <><Check className="w-3 h-3" /> Finalising...</>}
              {uploadProgress >= 100 && <><Check className="w-3 h-3" /> Upload complete</>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-3xl mx-auto">
        <StageIndicator currentStage={0} />
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-coral-50 dark:bg-coral-900/20 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-7 h-7 text-coral-600 dark:text-coral-400" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-2">Upload failed</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">{errorMessage}</p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => { setPhase('upload'); setFile(null); setErrorMessage(null); }}>Try again</Button>
            <Button variant="ghost" onClick={() => navigate('/writer/screenplays')}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  if (creditLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">
        Loading upload...
      </div>
    );
  }

  if (!hasCredits) {
    const pointsPerCredit = config?.points_per_credit ?? 1000;
    const currentPoints = balance?.contribution_points ?? 0;
    const remainingPoints = Math.max(0, pointsPerCredit - currentPoints);
    const progressPct = Math.min(100, (currentPoints / pointsPerCredit) * 100);
    const availableCredits = balance?.upload_credits ?? 0;

    const handleCreateReader = async () => {
      setCreatingReader(true);
      setRoleError(null);
      const { error } = await enableRole('reader');
      if (error) {
        setRoleError(error);
        setCreatingReader(false);
        return;
      }
      await refreshProfile();
      await loadCreditStatus();
      setCreatingReader(false);
    };

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/writer/screenplays')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to screenplays
        </button>

        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-5">
            <Upload className="w-8 h-8 text-ink-400 dark:text-ink-500" />
          </div>

          <h1 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">Upload Another Screenplay</h1>
          <p className="text-ink-500 dark:text-ink-400 mb-6 max-w-md mx-auto">
            You've used all of your available Upload Credits.
          </p>

          <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-5 mb-6 text-left">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-accent-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ink-600 dark:text-ink-300">
                Earn another Upload Credit by contributing as a reader. Read assigned screenplays and provide meaningful feedback to collect Contribution Points.
              </p>
            </div>
          </div>

          {hasReaderRole ? (
            <div className="space-y-5 text-left">
              <div className="border-t border-ink-100 dark:border-ink-800 pt-5">
                <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">You're Already a Reader</h2>
                <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
                  Continue reading assigned screenplays and submitting meaningful feedback to earn Contribution Points towards your next Upload Credit.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4 text-center">
                    <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">Contribution Points</div>
                    <div className="text-2xl font-bold text-ink-900 dark:text-white tabular-nums">{currentPoints}</div>
                    <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">of {pointsPerCredit} needed</div>
                  </div>
                  <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4 text-center">
                    <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">Upload Credits</div>
                    <div className="text-2xl font-bold text-ink-900 dark:text-white tabular-nums">{availableCredits}</div>
                    <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">available</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-ink-400 dark:text-ink-500 mb-1.5">
                    <span>Progress to next Upload Credit</span>
                    <span className="font-medium text-ink-600 dark:text-ink-300 tabular-nums">{remainingPoints} points remaining</span>
                  </div>
                  <div className="h-2.5 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button size="lg" onClick={() => switchRole('reader').then(() => navigate('/reader'))}>
                  <BookOpen className="w-4 h-4" /> Go to Reader Dashboard
                </Button>
                <Button variant="secondary" onClick={() => navigate('/reader/contribution')}>
                  <Award className="w-4 h-4" /> View Contribution History
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-left">
              <div className="border-t border-ink-100 dark:border-ink-800 pt-5">
                <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Become a Reader</h2>
                <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
                  Reading assigned screenplays helps other writers while earning Contribution Points towards additional Upload Credits.
                </p>
              </div>

              {roleError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {roleError}
                </div>
              )}

              <Button size="lg" className="w-full" onClick={handleCreateReader} disabled={creatingReader}>
                {creatingReader ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Reader Profile...</> : <><BookOpen className="w-4 h-4" /> Create Reader Profile</>}
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StageIndicator currentStage={0} />

      <button onClick={() => navigate('/writer/screenplays')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to screenplays
      </button>

      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Upload Screenplay</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">Upload a completed screenplay ready for community feedback.</p>
        </div>
        <Badge color={eligibility === 'free' ? 'forest' : 'accent'}>
          <Gift className="w-3 h-3 mr-1 inline" />
          {eligibility === 'free' ? 'Free upload credit' : `${balance?.upload_credits ?? 0} credit${(balance?.upload_credits ?? 0) !== 1 ? 's' : ''} available`}
        </Badge>
      </div>

      <Card className="p-0 overflow-hidden mb-4">
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-ink-200 dark:border-ink-700 rounded-2xl p-12 text-center hover:border-ink-300 dark:hover:border-ink-600 transition-colors cursor-pointer"
          onClick={() => document.getElementById('pdf-input')?.click()}
        >
          <input
            id="pdf-input"
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-5">
            <FileUp className="w-8 h-8 text-ink-400 dark:text-ink-500" />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">Drag and drop your PDF here</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">or click to browse your files</p>
          <div className="flex items-center justify-center gap-4 text-xs text-ink-400 dark:text-ink-500">
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> PDF format only</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Max 25MB</span>
          </div>
        </div>
      </Card>

      <button
        onClick={() => setShowEligibility(true)}
        className="text-sm text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 transition-colors flex items-center gap-1.5"
      >
        <Info className="w-3.5 h-3.5" /> Is my screenplay eligible?
      </button>

      {showEligibility && <EligibilityModal onClose={() => setShowEligibility(false)} />}
    </div>
  );
}

function EligibilityModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-ink-100 dark:border-ink-800 sticky top-0 bg-white dark:bg-ink-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent-500" />
            </div>
            <h2 className="text-lg font-bold text-ink-900 dark:text-white">Screenplay Eligibility</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Scrinit is designed for completed screenplays that are ready for meaningful community feedback.
          </p>

          <div>
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">Please upload your screenplay only if it:</h3>
            <ul className="space-y-2">
              {[
                'Is complete.',
                'Is properly formatted.',
                'Is readable from beginning to end.',
                'Represents your current best draft.',
                'Is ready to receive constructive feedback from other writers.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-600 dark:text-ink-300">
                  <Check className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">The following should not be uploaded:</h3>
            <ul className="space-y-2">
              {[
                'Incomplete screenplays.',
                'Scene collections.',
                'Story notes.',
                'Outlines.',
                'Treatments.',
                'Exploratory first drafts.',
                'Produced screenplays.',
                'Screenplays already in active professional development.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-600 dark:text-ink-300">
                  <X className="w-4 h-4 text-coral-500 flex-shrink-0 mt-0.5" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <p className="text-sm text-ink-600 dark:text-ink-300">
              If you revise your screenplay after receiving feedback, upload the new draft as a new version of the existing screenplay rather than creating a separate project.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-ink-100 dark:border-ink-800 sticky bottom-0 bg-white dark:bg-ink-900">
          <Button className="w-full" onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  );
}
