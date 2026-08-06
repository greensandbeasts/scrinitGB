import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft, Upload, FileText, Check, AlertCircle, Loader2,
  X, FileUp, ShieldCheck, Sparkles, BookOpen, Award, Gift,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ScreenplayVisibility, ReaderContributionBalance, ContributionAlgorithmVersion } from '@/lib/types';

interface WriterUploadProps {
  navigate: (to: string) => void;
}

interface ProcessResult {
  success: boolean;
  pageCount: number;
  title: string | null;
  metadata: {
    title: string | null;
    logline: string | null;
    synopsis: string | null;
    genre: string | null;
    secondaryGenre: string | null;
    formatType: string | null;
    budgetRange: string | null;
    themes: string[];
    primarySetting: string | null;
    timePeriod: string | null;
    tone: string | null;
    targetAudience: string | null;
    tags: string[];
  };
  sanitisation: {
    hasIdentifyingInfo: boolean;
    notes: string[];
  };
  error?: string;
}

type Phase = 'upload' | 'processing' | 'validation' | 'metadata' | 'saving' | 'error';

const GENRES = ['Thriller', 'Drama', 'Science Fiction', 'Horror', 'Comedy', 'Romance', 'Action', 'Mystery', 'Adventure', 'Fantasy', 'Documentary', 'Animation'];
const FORMATS = ['Feature', 'TV Pilot', 'Short', 'Web Series', 'Mini-Series', 'Documentary'];
const BUDGET_RANGES = ['Micro (Under $1M)', 'Low ($1M-$5M)', 'Medium ($5M-$50M)', 'High ($50M+)'];
const TONES = ['Dark', 'Light-hearted', 'Tense', 'Emotional', 'Gritty', 'Comedic', 'Inspirational', 'Suspenseful'];

const COVER_COLORS = [
  { key: 'amber', class: 'bg-accent-500' },
  { key: 'sky', class: 'bg-sea-500' },
  { key: 'emerald', class: 'bg-forest-500' },
  { key: 'rose', class: 'bg-coral-500' },
  { key: 'slate', class: 'bg-ink-500' },
];

export function WriterUpload({ navigate }: WriterUploadProps) {
  const { profile, userRoles, enableRole, switchRole, refreshProfile } = useAuth();
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);

  // Credit state
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

  // Poll for credit status changes every 10 seconds (catches credits earned while reading in another tab)
  useEffect(() => {
    if (!profile || eligibility !== 'none') return;
    const interval = setInterval(loadCreditStatus, 10000);
    return () => clearInterval(interval);
  }, [profile, eligibility, loadCreditStatus]);

  const hasCredits = eligibility === 'free' || eligibility === 'earned';

  // Metadata form fields
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('Drama');
  const [secondaryGenre, setSecondaryGenre] = useState('');
  const [formatType, setFormatType] = useState('Feature');
  const [budgetRange, setBudgetRange] = useState('Medium ($5M-$50M)');
  const [themes, setThemes] = useState<string[]>([]);
  const [themesInput, setThemesInput] = useState('');
  const [primarySetting, setPrimarySetting] = useState('');
  const [timePeriod, setTimePeriod] = useState('');
  const [tone, setTone] = useState('');
  const [targetAudience, setTargetAudience] = useState('Adult');
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [coverColor, setCoverColor] = useState('amber');
  const [visibility, setVisibility] = useState<ScreenplayVisibility>('private');

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

    // Re-check upload credits before accepting the file
    const { data: elig } = await supabase.rpc('check_upload_eligibility', { p_user_id: profile.id });
    if (elig === 'none') {
      setPhase('upload');
      setErrorMessage('No upload credits available.');
      await loadCreditStatus();
      return;
    }

    // Validate file type
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setPhase('error');
      setErrorMessage('Only PDF files are accepted. Please upload a .pdf file.');
      return;
    }

    // Validate file size
    const maxSize = 25 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setPhase('error');
      setErrorMessage(`File exceeds the 25MB limit. Your file is ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }

    setPhase('processing');
    setUploadProgress(20);

    // Generate storage path
    const filePath = `${profile.id}/${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    setStoragePath(filePath);

    try {
      setUploadProgress(50);

      // Call the process-upload edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPhase('error');
        setErrorMessage('Authentication required.');
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('path', filePath);

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

      setUploadProgress(80);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Processing failed" }));
        setPhase('error');
        setErrorMessage(errData.error || "Failed to process the file.");
        return;
      }

      const result: ProcessResult = await response.json();
      setUploadProgress(100);

      if (!result.success) {
        setPhase('error');
        setErrorMessage(result.error || "Validation failed.");
        return;
      }

      setProcessResult(result);
      setPhase('validation');

      // Pre-fill metadata from extraction
      if (result.metadata.title) setTitle(result.metadata.title);
      if (result.metadata.logline) setLogline(result.metadata.logline);
      if (result.metadata.synopsis) setSynopsis(result.metadata.synopsis);
      if (result.metadata.genre) setGenre(result.metadata.genre);
      if (result.metadata.secondaryGenre) setSecondaryGenre(result.metadata.secondaryGenre);
      if (result.metadata.formatType) setFormatType(result.metadata.formatType);
      if (result.metadata.budgetRange) setBudgetRange(result.metadata.budgetRange);
      if (result.metadata.themes.length > 0) setThemes(result.metadata.themes);
      if (result.metadata.primarySetting) setPrimarySetting(result.metadata.primarySetting);
      if (result.metadata.timePeriod) setTimePeriod(result.metadata.timePeriod);
      if (result.metadata.tone) setTone(result.metadata.tone);
      if (result.metadata.targetAudience) setTargetAudience(result.metadata.targetAudience);
      if (result.metadata.tags.length > 0) setTags(result.metadata.tags);
    } catch {
      setPhase('error');
      setErrorMessage('An unexpected error occurred while processing your file.');
    }
  };

  const handleProceedToMetadata = () => {
    setPhase('metadata');
  };

  const handleAddTheme = () => {
    const t = themesInput.trim();
    if (t && !themes.includes(t)) {
      setThemes([...themes, t]);
    }
    setThemesInput('');
  };

  const handleAddTag = () => {
    const t = tagsInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagsInput('');
  };

  const handleSave = async (saveVisibility: ScreenplayVisibility) => {
    if (!profile || !storagePath) return;

    // Final credit check before creating the screenplay record
    const { data: elig } = await supabase.rpc('check_upload_eligibility', { p_user_id: profile.id });
    if (elig === 'none') {
      setPhase('upload');
      setErrorMessage('No upload credits available. Your screenplay was not saved.');
      await loadCreditStatus();
      return;
    }

    setPhase('saving');

    const anonymousPath = storagePath; // Same path in the 'anonymous-copies' bucket

    const insertData = {
      writer_id: profile.id,
      title: title.trim() || 'Untitled',
      genre,
      logline: logline.trim() || 'No logline provided.',
      synopsis: synopsis.trim() || null,
      content: [],
      page_count: processResult?.pageCount ?? 1,
      status: 'published' as const,
      cover_color: coverColor,
      tags,
      published_at: new Date().toISOString(),
      original_pdf_path: storagePath,
      anonymous_pdf_path: anonymousPath,
      visibility: saveVisibility,
      secondary_genre: secondaryGenre.trim() || null,
      format_type: formatType,
      budget_range: budgetRange,
      themes,
      primary_setting: primarySetting.trim() || null,
      time_period: timePeriod.trim() || null,
      tone: tone || null,
      target_audience: targetAudience,
      sanitisation_notes: processResult?.sanitisation.notes.join(', ') || null,
    };
console.log("Profile:", profile);
console.log("Insert data:", insertData);
const { data, error: insertError } = await supabase
  .from('screenplays')
  .insert(insertData)
  .select();

console.log("Inserted row:", data);
console.log("Insert error:", insertError);

 if (insertError) {
  console.error("Insert error:", insertError);
  setPhase('error');
  setErrorMessage(JSON.stringify(insertError, null, 2));
  return;
}

    // Copy the file to anonymous-copies bucket (in production, the edge function would
    // create a sanitised copy; here we reference the same file path in the anonymous bucket)
    try {
      const { data: fileData } = await supabase.storage
        .from('screenplays')
        .download(storagePath);
      if (fileData) {
        await supabase.storage
          .from('anonymous-copies')
          .upload(anonymousPath, fileData, { contentType: 'application/pdf' });
      }
    } catch {
      // Anonymous copy creation is best-effort; the screenplay record is already saved
    }

    navigate('/writer/screenplays');
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all';
  const labelClass = 'block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5';

  // ─── UPLOAD PHASE ───────────────────────────────────────────────────────
  if (phase === 'upload') {
    if (creditLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">
          Loading upload...
        </div>
      );
    }

    // No upload credits available — show the Submission Credit information panel
    if (!hasCredits) {
      const pointsPerCredit = config?.points_per_credit ?? 1000;
      const currentPoints = balance?.contribution_points ?? 0;
      const remainingPoints = Math.max(0, pointsPerCredit - currentPoints);
      const progressPct = Math.min(100, (currentPoints / pointsPerCredit) * 100);
      const availableCredits = (balance?.upload_credits ?? 0) + (balance?.free_upload_used ? 0 : 0);

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
                      <div
                        className="h-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
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

    // Credits available — show the normal upload interface
    return (
      <div className="space-y-6 max-w-3xl">
        <button onClick={() => navigate('/writer/screenplays')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to screenplays
        </button>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Upload screenplay</h1>
            <p className="text-ink-500 dark:text-ink-400 mt-1">Upload a PDF from Final Draft, Fade In, WriterDuet, or any screenwriting software.</p>
          </div>
          <Badge color={eligibility === 'free' ? 'forest' : 'accent'}>
            <Gift className="w-3 h-3 mr-1 inline" />
            {eligibility === 'free' ? 'Free upload credit' : `${balance?.upload_credits ?? 0} credit${(balance?.upload_credits ?? 0) !== 1 ? 's' : ''} available`}
          </Badge>
        </div>

        <Card className="p-0 overflow-hidden">
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

        <div className="bg-ink-50 dark:bg-ink-900 rounded-xl p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-ink-500 dark:text-ink-400">
            <p className="font-medium text-ink-700 dark:text-ink-300 mb-1">What happens next?</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>We validate your PDF (page count, encryption, corruption)</li>
              <li>We automatically extract metadata (title, genre, format, themes)</li>
              <li>We scan for identifying information and create an anonymous reading copy</li>
              <li>You review and confirm the metadata before publishing</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ─── PROCESSING PHASE ──────────────────────────────────────────────────
  if (phase === 'processing') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-8 h-8 text-ink-400 dark:text-ink-500 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-2">Processing your screenplay</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-8">
          {file?.name} · {(file ? file.size / 1024 / 1024 : 0).toFixed(1)}MB
        </p>
        <div className="max-w-sm mx-auto">
          <div className="h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-500" style={{ width: `${uploadProgress}%` }} />
          </div>
          <div className="mt-3 text-xs text-ink-400 dark:text-ink-500 flex items-center justify-center gap-2">
            {uploadProgress < 50 && <><Upload className="w-3 h-3" /> Uploading...</>}
            {uploadProgress >= 50 && uploadProgress < 80 && <><FileText className="w-3 h-3" /> Validating PDF...</>}
            {uploadProgress >= 80 && uploadProgress < 100 && <><Sparkles className="w-3 h-3" /> Extracting metadata...</>}
            {uploadProgress >= 100 && <><Check className="w-3 h-3" /> Processing complete</>}
          </div>
        </div>
      </div>
    );
  }

  // ─── VALIDATION PHASE ──────────────────────────────────────────────────
  if (phase === 'validation' && processResult) {
    return (
      <div className="space-y-6 max-w-2xl">
        <button onClick={() => navigate('/writer/screenplays')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to screenplays
        </button>

        <div>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Validation complete</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">Your screenplay passed validation. Review the results below.</p>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-forest-50 dark:bg-forest-900/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-forest-600 dark:text-forest-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink-900 dark:text-white">PDF validated successfully</h2>
              <p className="text-sm text-ink-400 dark:text-ink-500">{processResult.pageCount} pages detected</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-3">
              <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">File</div>
              <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{file?.name}</div>
            </div>
            <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-3">
              <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">Pages</div>
              <div className="text-sm font-medium text-ink-900 dark:text-white">{processResult.pageCount}</div>
            </div>
          </div>

          {processResult.sanitisation.hasIdentifyingInfo ? (
            <div className="bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-accent-600 dark:text-accent-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-1">Identifying information detected</h3>
                  <p className="text-sm text-ink-600 dark:text-ink-300 mb-2">
                    We found the following in your PDF. An anonymous reading copy will be generated automatically for readers and industry:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {processResult.sanitisation.notes.map((note) => (
                      <Badge key={note} color="accent">{note}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-forest-600 dark:text-forest-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-ink-900 dark:text-white mb-1">No identifying information found</h3>
                  <p className="text-sm text-ink-600 dark:text-ink-300">Your screenplay appears to be clean. An anonymous reading copy will still be generated for distribution.</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-2">Extracted metadata preview</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {processResult.metadata.title && <div><span className="text-ink-400 dark:text-ink-500">Title:</span> <span className="text-ink-900 dark:text-white font-medium">{processResult.metadata.title}</span></div>}
              {processResult.metadata.genre && <div><span className="text-ink-400 dark:text-ink-500">Genre:</span> <span className="text-ink-900 dark:text-white font-medium">{processResult.metadata.genre}</span></div>}
              {processResult.metadata.formatType && <div><span className="text-ink-400 dark:text-ink-500">Format:</span> <span className="text-ink-900 dark:text-white font-medium">{processResult.metadata.formatType}</span></div>}
              {processResult.metadata.tone && <div><span className="text-ink-400 dark:text-ink-500">Tone:</span> <span className="text-ink-900 dark:text-white font-medium">{processResult.metadata.tone}</span></div>}
            </div>
            <p className="text-xs text-ink-400 dark:text-ink-500 mt-3">You can review and edit all metadata on the next screen.</p>
          </div>

          <Button size="lg" className="w-full mt-6" onClick={handleProceedToMetadata}>
            Review metadata <ArrowLeft className="w-4 h-4 rotate-180" />
          </Button>
        </Card>
      </div>
    );
  }

  // ─── METADATA PHASE ────────────────────────────────────────────────────
  if (phase === 'metadata') {
    return (
      <div className="space-y-6 max-w-4xl">
        <button onClick={() => navigate('/writer/screenplays')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to screenplays
        </button>

        <div>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Review metadata</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">We've pre-filled the metadata from your PDF. Edit any field before publishing.</p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title *</label>
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Screenplay title" />
            </div>
            <div>
              <label className={labelClass}>Genre *</label>
              <select className={inputClass} value={genre} onChange={(e) => setGenre(e.target.value)}>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Secondary genre</label>
              <select className={inputClass} value={secondaryGenre} onChange={(e) => setSecondaryGenre(e.target.value)}>
                <option value="">None</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Format</label>
              <select className={inputClass} value={formatType} onChange={(e) => setFormatType(e.target.value)}>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Logline *</label>
            <input className={inputClass} value={logline} onChange={(e) => setLogline(e.target.value)} placeholder="A one-sentence summary" />
          </div>

          <div>
            <label className={labelClass}>Synopsis</label>
            <textarea className={`${inputClass} resize-none`} rows={3} value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="A longer description of the story..." />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Budget range</label>
              <select className={inputClass} value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)}>
                {BUDGET_RANGES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tone</label>
              <select className={inputClass} value={tone} onChange={(e) => setTone(e.target.value)}>
                <option value="">Auto-detect</option>
                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Primary setting</label>
              <input className={inputClass} value={primarySetting} onChange={(e) => setPrimarySetting(e.target.value)} placeholder="e.g. New York City" />
            </div>
            <div>
              <label className={labelClass}>Time period</label>
              <input className={inputClass} value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} placeholder="e.g. Present day, 1940s" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Themes</label>
            <div className="flex gap-2 mb-2">
              <input
                className={inputClass}
                value={themesInput}
                onChange={(e) => setThemesInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTheme())}
                placeholder="Add a theme and press Enter"
              />
              <Button variant="secondary" size="sm" onClick={handleAddTheme}>Add</Button>
            </div>
            {themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {themes.map(t => (
                  <button key={t} onClick={() => setThemes(themes.filter(x => x !== t))} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink-100 dark:bg-ink-800 text-xs font-medium text-ink-600 dark:text-ink-300 hover:bg-coral-50 hover:text-coral-600 transition-colors">
                    {t} <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Tags / Keywords</label>
            <div className="flex gap-2 mb-2">
              <input
                className={inputClass}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a keyword and press Enter"
              />
              <Button variant="secondary" size="sm" onClick={handleAddTag}>Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <button key={t} onClick={() => setTags(tags.filter(x => x !== t))} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink-100 dark:bg-ink-800 text-xs font-medium text-ink-600 dark:text-ink-300 hover:bg-coral-50 hover:text-coral-600 transition-colors">
                    #{t} <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Target audience</label>
              <select className={inputClass} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}>
                <option value="General">General</option>
                <option value="Adult">Adult</option>
                <option value="Young Adult">Young Adult</option>
                <option value="Family">Family</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Cover colour</label>
              <div className="flex gap-2">
                {COVER_COLORS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setCoverColor(c.key)}
                    className={`w-9 h-9 rounded-lg transition-all ${c.class} ${coverColor === c.key ? 'ring-2 ring-offset-2 ring-ink-400 dark:ring-offset-ink-900' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Visibility selection */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Visibility</h2>
          <div className="space-y-3">
            <VisibilityOption
              value="private"
              label="Private"
              desc="Visible only to you. No reader assignments, no industry discovery."
              current={visibility}
              onSelect={setVisibility}
            />
            <VisibilityOption
              value="readers_only"
              label="Readers Only (Recommended)"
              desc="Assigned to anonymous readers. Generates audience analytics. Hidden from industry until qualified."
              current={visibility}
              onSelect={setVisibility}
            />
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={() => handleSave(visibility)} disabled={!title.trim() || !logline.trim()}>
            <Check className="w-4 h-4" /> Publish screenplay
          </Button>
          <Button variant="secondary" onClick={() => handleSave('private')}>
            Save as private
          </Button>
          <Button variant="ghost" onClick={() => navigate('/writer/screenplays')}>Cancel</Button>
        </div>
      </div>
    );
  }

  // ─── SAVING PHASE ──────────────────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <Loader2 className="w-10 h-10 text-ink-300 dark:text-ink-600 animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-ink-900 dark:text-white mb-1">Saving your screenplay...</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400">Creating anonymous reading copy and storing securely.</p>
      </div>
    );
  }

  // ─── ERROR PHASE ───────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
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
    );
  }

  return null;
}

function VisibilityOption({ value, label, desc, current, onSelect }: {
  value: ScreenplayVisibility;
  label: string;
  desc: string;
  current: ScreenplayVisibility;
  onSelect: (v: ScreenplayVisibility) => void;
}) {
  const isActive = current === value;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
        isActive ? 'border-ink-900 dark:border-white bg-ink-50 dark:bg-ink-800' : 'border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600'
      }`}
    >
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
        isActive ? 'border-ink-900 dark:border-white' : 'border-ink-300 dark:border-ink-600'
      }`}>
        {isActive && <div className="w-2.5 h-2.5 rounded-full bg-ink-900 dark:bg-white" />}
      </div>
      <div>
        <div className={`text-sm font-semibold ${isActive ? 'text-ink-900 dark:text-white' : 'text-ink-700 dark:text-ink-300'}`}>{label}</div>
        <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}
