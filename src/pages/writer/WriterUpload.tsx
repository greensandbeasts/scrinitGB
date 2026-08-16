import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  FileText,
  Gift,
  Info,
  Languages,
  Loader2,
  Lock,
  Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import type {
  ContributionAlgorithmVersion,
  ReaderContributionBalance,
  ScreenplayVisibility,
} from '@/lib/types';
import {
  BUDGET_RANGE_OPTIONS,
  COUNTRY_OPTIONS,
  FORMAT_OPTIONS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  SETTING_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  THEME_OPTIONS,
} from '@/lib/lookups';

interface WriterUploadProps {
  navigate: (to: string) => void;
}

type TitlePageValidation =
  | 'valid'
  | 'title_mismatch'
  | 'identifying_information'
  | 'unreadable';

interface ProcessResult {
  success: boolean;
  screenplayId?: string;
  pageCount?: number;
  validation?: TitlePageValidation;
  error?: string;
}

const fieldClass =
  'w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700 transition-all';

const labelClass =
  'block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5';

function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} appearance-none pr-10`}
      >
        <option value="" disabled>
          {placeholder}
        </option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
    </div>
  );
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  icon: Icon,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { code: string; name: string }[];
  placeholder: string;
  searchPlaceholder: string;
  icon?: typeof Languages;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(
    () =>
      options.filter((option) =>
        option.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [options, query],
  );

  const selected = options.find((option) => option.code === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClass} flex items-center gap-2 text-left`}
      >
        {Icon && <Icon className="w-4 h-4 text-ink-400" />}

        <span className={`flex-1 ${selected ? '' : 'text-ink-400'}`}>
          {selected?.name ?? placeholder}
        </span>

        <ChevronDown className="w-4 h-4 text-ink-400" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close selection menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute z-50 mt-1 w-full rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-xl overflow-hidden">
            <div className="p-2 border-b border-ink-100 dark:border-ink-800">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className={fieldClass}
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => {
                    onChange(option.code);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <span>{option.name}</span>

                  {option.code === value && (
                    <Check className="w-4 h-4 text-accent-500" />
                  )}
                </button>
              ))}

              {filteredOptions.length === 0 && (
                <p className="px-4 py-3 text-sm text-ink-400 text-center">
                  No results found
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  );

  const toggle = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option],
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClass} flex items-center gap-2 text-left`}
      >
        <span className={`flex-1 ${selected.length ? '' : 'text-ink-400'}`}>
          {selected.length ? `${selected.length} selected` : placeholder}
        </span>

        <ChevronDown className="w-4 h-4 text-ink-400" />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className="px-2.5 py-1 rounded-lg bg-ink-100 dark:bg-ink-800 text-xs text-ink-700 dark:text-ink-300"
            >
              {option} ×
            </button>
          ))}
        </div>
      )}

      {open && (
        <>
          <button
            type="button"
            aria-label="Close selection menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute z-50 mt-1 w-full rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-xl overflow-hidden">
            <div className="p-2 border-b border-ink-100 dark:border-ink-800">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${placeholder.toLowerCase()}...`}
                className={fieldClass}
              />
            </div>

            <div className="max-h-60 overflow-y-auto p-1">
              {filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggle(option)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <span>{option}</span>

                  {selected.includes(option) && (
                    <Check className="w-4 h-4 text-accent-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [value, setValue] = useState('');

  const addTag = () => {
    const tag = value.trim();

    if (tag && !tags.includes(tag) && tags.length < 10) {
      onChange([...tags, tag]);
    }

    setValue('');
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTag();
            }
          }}
          className={fieldClass}
          placeholder="Type a tag and press Enter"
        />

        <Button
          type="button"
          variant="secondary"
          onClick={addTag}
          disabled={!value.trim() || tags.length >= 10}
        >
          Add
        </Button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                onChange(tags.filter((currentTag) => currentTag !== tag))
              }
              className="px-2.5 py-1 rounded-lg bg-ink-100 dark:bg-ink-800 text-xs text-ink-700 dark:text-ink-300"
            >
              {tag} ×
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-400 mt-1.5">
        Add up to 10 searchable tags.
      </p>
    </div>
  );
}

export function WriterUpload({ navigate }: WriterUploadProps) {
  const { profile } = useAuth();

  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [balance, setBalance] =
    useState<ReaderContributionBalance | null>(null);

  const [config, setConfig] =
    useState<ContributionAlgorithmVersion | null>(null);

  const [eligibility, setEligibility] =
    useState<'free' | 'earned' | 'none' | null>(null);

  const [creditLoading, setCreditLoading] = useState(true);

  const [eligibilityModalOpen, setEligibilityModalOpen] = useState(false);
  const [contentPolicyModalOpen, setContentPolicyModalOpen] = useState(false);

  const [form, setForm] = useState({
    title: '',
    format_type: '',
    genre: '',
    logline: '',
    synopsis: '',
    language: 'en',
    secondary_genre: '',
    themes: [] as string[],
    primary_setting: '',
    time_period: 'Present Day',
    country: '',
    target_audience: '',
    budget_range: '',
    tags: [] as string[],
    visibility: 'private' as ScreenplayVisibility,
  });

  function EligibilityModal({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) {
    return (
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onClose();
          }
        }}
      >
        <DialogContent className="p-6">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-4">
            Screenplay Eligibility
          </h2>

          <div className="prose dark:prose-invert mb-6">
            <p>
              Scrinit is designed for completed screenplays that are ready for
              meaningful community feedback.
            </p>

            <p>Please upload your screenplay only if it:</p>

            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>Is complete.</li>
              <li>Is properly formatted.</li>
              <li>Is readable from beginning to end.</li>
              <li>Represents your current best draft.</li>
              <li>
                Is ready to receive constructive feedback from other writers.
              </li>
              <li>Has a first page containing only the screenplay title.</li>
              <li>Contains no identifying information on the first page.</li>
            </ul>

            <h3 className="text-lg font-bold text-ink-900 dark:text-white mt-4">
              Title Page Requirement
            </h3>

            <p>
              The first page of every screenplay must contain{' '}
              <strong className="font-semibold">
                only the title of the screenplay
              </strong>
              .
            </p>

            <p>
              The title on the first page must match the title entered in the
              metadata.
            </p>

            <p>The first page must not contain:</p>

            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>Writer name.</li>
              <li>Contact details.</li>
              <li>Email address.</li>
              <li>Phone number.</li>
              <li>Website.</li>
              <li>Social media handle.</li>
              <li>Production company.</li>
              <li>Agent or manager details.</li>
              <li>Copyright information.</li>
              <li>Address.</li>
              <li>Any other identifying information.</li>
            </ul>

            <p>
              The screenplay itself may naturally contain character names,
              fictional contact details and other story content.
            </p>

            <p>
              Scrinit only performs the mandatory anonymity check on the{' '}
              <strong className="font-semibold">first page</strong>.
            </p>

            <h3 className="text-lg font-bold text-ink-900 dark:text-white mt-4">
              The following should not be uploaded:
            </h3>

            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>Incomplete screenplays.</li>
              <li>Scene collections.</li>
              <li>Story notes.</li>
              <li>Outlines.</li>
              <li>Treatments.</li>
              <li>Exploratory first drafts.</li>
              <li>Produced screenplays.</li>
              <li>Screenplays already in active professional development.</li>
            </ul>

            <p>
              If you revise your screenplay after receiving feedback, upload
              the new draft as a new version of the existing screenplay rather
              than creating a separate project.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" onClick={onClose} variant="secondary">
              Close
            </Button>

            <Button
              type="button"
              onClick={() => {
                onClose();
                setContentPolicyModalOpen(true);
              }}
            >
              View Content Policy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function ContentPolicyModal({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) {
    return (
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onClose();
          }
        }}
      >
        <DialogContent className="p-6">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-4">
            Scrinit Content Policy
          </h2>

          <div className="prose dark:prose-invert mb-6">
            <p>
              Screenplays may contain mature fictional subject matter,
              including violence, crime, murder, abuse, strong language,
              sexual themes, discrimination, racism as part of
              characterisation or story, drug use, horror and disturbing or
              controversial themes.
            </p>

            <p>Screenplays must not contain prohibited material, including:</p>

            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>
                Pornographic material whose primary purpose is sexual
                gratification.
              </li>
              <li>Sexual content involving minors.</li>
              <li>Sexual exploitation or sexualisation of minors.</li>
              <li>
                Content that facilitates real-world criminal activity or
                violence.
              </li>
              <li>
                Material primarily intended to promote hatred against protected
                groups.
              </li>
              <li>
                Content promoting or recruiting for terrorist or extremist
                organisations.
              </li>
              <li>
                Other material that Scrinit is legally or operationally
                prohibited from hosting.
              </li>
            </ul>

            <p>
              Fictional depiction of difficult subject matter is not
              automatically prohibited simply because it is disturbing,
              offensive or mature.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const loadCreditStatus = useCallback(async () => {
    if (!profile) {
      setCreditLoading(false);
      return;
    }

    try {
      const [eligibilityResult, balanceResult, configResult] =
        await Promise.all([
          supabase.rpc('check_upload_eligibility', {
            p_user_id: profile.id,
          }),
          supabase.rpc('get_or_create_balance', {
            p_reader_id: profile.id,
          }),
          supabase.rpc('get_algorithm_config'),
        ]);

      setEligibility(
        (eligibilityResult.data as 'free' | 'earned' | 'none') ?? 'none',
      );

      setBalance(
        (balanceResult.data as unknown as ReaderContributionBalance) ?? null,
      );

      setConfig(
        configResult.data as ContributionAlgorithmVersion | null,
      );
    } finally {
      setCreditLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadCreditStatus();
  }, [loadCreditStatus]);

  const selectFile = (selectedFile: File) => {
    setFileError(null);
    setSubmissionError(null);

    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setFile(null);
      setFileError('Only PDF files are accepted. Please select a .pdf file.');
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setFile(null);
      setFileError('The PDF must be 25MB or smaller.');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile) {
      selectFile(droppedFile);
    }
  };

  const trimmedLoglineLength = form.logline.trim().length;
  const trimmedSynopsisLength = form.synopsis.trim().length;

  const detailsValid = Boolean(
    form.title.trim() &&
      form.format_type &&
      form.genre &&
      trimmedLoglineLength >= 1 &&
      trimmedLoglineLength <= 200 &&
      trimmedSynopsisLength >= 250 &&
      trimmedSynopsisLength <= 1500 &&
      form.language,
  );

  const canSubmit =
    detailsValid &&
    Boolean(file) &&
    !fileError &&
    !submitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file || !detailsValid || submitting) {
      return;
    }

    setSubmissionError(null);
    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Authentication required.');
      }

      const submission = new FormData();

      submission.append('file', file);
      submission.append('metadata', JSON.stringify(form));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: submission,
        },
      );

      let result: ProcessResult;

      try {
        result = (await response.json()) as ProcessResult;
      } catch {
        throw new Error(
          'The upload service returned an invalid response. Please try again.',
        );
      }

      if (!response.ok || !result.success) {
        if (result.validation === 'title_mismatch') {
          throw new Error(
            'The title on the first page does not match the screenplay title entered above.',
          );
        }

        if (result.validation === 'identifying_information') {
          throw new Error(
            'The first page contains identifying information. It must contain only the screenplay title.',
          );
        }

        if (result.validation === 'unreadable') {
          throw new Error(
            'Scrinit could not verify the first page of this PDF. Please upload a readable screenplay PDF.',
          );
        }

        throw new Error(
          result.error || 'The screenplay could not be submitted.',
        );
      }

      await loadCreditStatus();

      if (result.screenplayId) {
        navigate(`/writer/screenplay/${result.screenplayId}`);
      } else {
        navigate('/writer/screenplays');
      }
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'The screenplay could not be submitted.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (creditLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-ink-400 animate-pulse">
        Loading upload...
      </div>
    );
  }

  if (eligibility === 'none') {
    const pointsPerCredit = config?.points_per_credit ?? 1000;
    const currentPoints = balance?.contribution_points ?? 0;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <button
          type="button"
          onClick={() => navigate('/writer/screenplays')}
          className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to screenplays
        </button>

        <Card className="p-8 text-center">
          <Upload className="w-10 h-10 text-ink-400 mx-auto mb-4" />

          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">
            No upload credits available
          </h1>

          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            Earn Contribution Points as a reader to unlock another screenplay
            upload.
          </p>

          <p className="mt-5 text-sm font-medium text-ink-700 dark:text-ink-300">
            {currentPoints} / {pointsPerCredit} points
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <form
        className="max-w-4xl mx-auto"
        onSubmit={handleSubmit}
      >
        <button
          type="button"
          onClick={() => navigate('/writer/screenplays')}
          className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to screenplays
        </button>

        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">
              Upload Screenplay
            </h1>

            <p className="text-ink-500 dark:text-ink-400 mt-1">
              Upload a completed screenplay ready for meaningful community
              feedback.
            </p>
          </div>

          <Badge color={eligibility === 'free' ? 'forest' : 'accent'}>
            <Gift className="w-3 h-3 mr-1" />

            {eligibility === 'free'
              ? 'Free upload credit'
              : `${balance?.upload_credits ?? 0} available`}
          </Badge>
        </div>

        <button
          type="button"
          className="text-sm text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white inline-flex items-center gap-1.5 mb-7"
          onClick={() => setEligibilityModalOpen(true)}
        >
          <Info className="w-3.5 h-3.5" />
          Is my screenplay eligible?
        </button>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-8 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center text-sm font-bold">
                1
              </span>

              <div>
                <h2 className="text-lg font-bold text-ink-900 dark:text-white">
                  Screenplay Details
                </h2>

                <p className="text-sm text-ink-500 dark:text-ink-400">
                  Enter the metadata readers will use to discover your work.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="title" className={labelClass}>
                  Title <span className="text-coral-500">*</span>
                </label>

                <input
                  id="title"
                  value={form.title}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      title: event.target.value,
                    })
                  }
                  className={fieldClass}
                  placeholder="Enter your screenplay title"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>
                    Format <span className="text-coral-500">*</span>
                  </label>

                  <SelectField
                    value={form.format_type}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        format_type: value,
                      })
                    }
                    options={FORMAT_OPTIONS}
                    placeholder="Select format"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Genre <span className="text-coral-500">*</span>
                  </label>

                  <SelectField
                    value={form.genre}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        genre: value,
                      })
                    }
                    options={GENRE_OPTIONS}
                    placeholder="Select genre"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between gap-3">
                  <label htmlFor="logline" className={labelClass}>
                    Logline <span className="text-coral-500">*</span>
                  </label>

                  <span
                    className={`text-xs ${
                      trimmedLoglineLength > 200
                        ? 'text-coral-600'
                        : 'text-ink-400'
                    }`}
                  >
                    {trimmedLoglineLength} / 200
                  </span>
                </div>

                <input
                  id="logline"
                  value={form.logline}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      logline: event.target.value,
                    })
                  }
                  className={fieldClass}
                  placeholder="A one-sentence summary of your screenplay"
                  aria-invalid={trimmedLoglineLength > 200}
                  required
                />
              </div>

              <div>
                <div className="flex justify-between gap-3">
                  <label htmlFor="synopsis" className={labelClass}>
                    Short Synopsis <span className="text-coral-500">*</span>
                  </label>

                  <span
                    className={`text-xs ${
                      trimmedSynopsisLength > 1500
                        ? 'text-coral-600'
                        : 'text-ink-400'
                    }`}
                  >
                    {trimmedSynopsisLength} / 1,500
                  </span>
                </div>

                <textarea
                  id="synopsis"
                  value={form.synopsis}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      synopsis: event.target.value,
                    })
                  }
                  rows={7}
                  className={`${fieldClass} resize-y`}
                  placeholder="Briefly summarise the story, including the central conflict and outcome."
                  aria-invalid={
                    trimmedSynopsisLength > 1500 ||
                    (trimmedSynopsisLength > 0 &&
                      trimmedSynopsisLength < 250)
                  }
                  required
                />

                <p className="text-xs text-ink-400 mt-1.5">
                  Briefly summarise the story, including the central conflict
                  and outcome. Minimum 250 characters.
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Language <span className="text-coral-500">*</span>
                </label>

                <SearchableSelect
                  value={form.language}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      language: value,
                    })
                  }
                  options={LANGUAGE_OPTIONS}
                  placeholder="Select language"
                  searchPlaceholder="Search languages..."
                  icon={Languages}
                />
              </div>
            </div>

            <div className="border-t border-ink-100 dark:border-ink-800 mt-7 pt-7">
              <h3 className="text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-5">
                Optional metadata
              </h3>

              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>
                      Secondary Genre
                    </label>

                    <SelectField
                      value={form.secondary_genre}
                      onChange={(value) =>
                        setForm({
                          ...form,
                          secondary_genre: value,
                        })
                      }
                      options={GENRE_OPTIONS}
                      placeholder="Select secondary genre"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Primary Setting
                    </label>

                    <SelectField
                      value={form.primary_setting}
                      onChange={(value) =>
                        setForm({
                          ...form,
                          primary_setting: value,
                        })
                      }
                      options={SETTING_OPTIONS}
                      placeholder="Select setting"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>
                      Country
                    </label>

                    <SearchableSelect
                      value={form.country}
                      onChange={(value) =>
                        setForm({
                          ...form,
                          country: value,
                        })
                      }
                      options={COUNTRY_OPTIONS}
                      placeholder="Select country"
                      searchPlaceholder="Search countries..."
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>
                      Target Audience
                    </label>

                    <SelectField
                      value={form.target_audience}
                      onChange={(value) =>
                        setForm({
                          ...form,
                          target_audience: value,
                        })
                      }
                      options={TARGET_AUDIENCE_OPTIONS}
                      placeholder="Select target audience"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Budget Range
                    </label>

                    <SelectField
                      value={form.budget_range}
                      onChange={(value) =>
                        setForm({
                          ...form,
                          budget_range: value,
                        })
                      }
                      options={BUDGET_RANGE_OPTIONS}
                      placeholder="Select budget range"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Themes
                  </label>

                  <MultiSelect
                    options={THEME_OPTIONS}
                    selected={form.themes}
                    onChange={(themes) =>
                      setForm({
                        ...form,
                        themes,
                      })
                    }
                    placeholder="Select themes"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Tags
                  </label>

                  <TagInput
                    tags={form.tags}
                    onChange={(tags) =>
                      setForm({
                        ...form,
                        tags,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-8 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center text-sm font-bold">
                2
              </span>

              <div>
                <h2 className="text-lg font-bold text-ink-900 dark:text-white">
                  Screenplay PDF Upload
                </h2>

                <p className="text-sm text-ink-500 dark:text-ink-400">
                  Upload the PDF that Scrinit will validate and submit.
                </p>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];

                if (selectedFile) {
                  selectFile(selectedFile);
                }
              }}
            />

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-ink-200 dark:border-ink-700 p-8 text-center hover:border-ink-300 dark:hover:border-ink-600 transition-colors"
            >
              <Upload className="w-9 h-9 text-ink-400 mx-auto mb-3" />

              {file ? (
                <>
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
                    <FileText className="w-4 h-4" />
                    {file.name}
                  </div>

                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-2">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>

                  <p className="text-xs text-ink-400 mt-2">
                    Click or drop another PDF to replace it.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">
                    Drag and drop your screenplay PDF here
                  </p>

                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
                    or click to choose a file. PDF only, maximum 25MB.
                  </p>
                </>
              )}
            </div>

            {file && !fileError && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 text-forest-700 dark:text-forest-400 text-sm flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>
                  PDF selected. It will be uploaded and validated when you
                  submit.
                </span>
              </div>
            )}

            {fileError && (
              <div
                role="alert"
                className="mt-4 px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{fileError}</span>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-8 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center text-sm font-bold">
                3
              </span>

              <div>
                <h2 className="text-lg font-bold text-ink-900 dark:text-white">
                  Visibility
                </h2>

                <p className="text-sm text-ink-500 dark:text-ink-400">
                  Choose who can initially discover your screenplay.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  form.visibility === 'private'
                    ? 'border-ink-300 dark:border-ink-600 bg-ink-50 dark:bg-ink-800'
                    : 'border-ink-100 dark:border-ink-800 hover:border-ink-200 dark:hover:border-ink-700'
                }`}
                onClick={() =>
                  setForm({
                    ...form,
                    visibility: 'private',
                  })
                }
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    form.visibility === 'private'
                      ? 'bg-ink-200 dark:bg-ink-700'
                      : 'bg-ink-100 dark:bg-ink-800'
                  }`}
                >
                  <Lock className="w-5 h-5 text-ink-500" />
                </div>

                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink-900 dark:text-white">
                    Private
                  </div>

                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                    Only visible to you. Does not appear in searches or receive
                    community reviews.
                  </div>
                </div>

                {form.visibility === 'private' && (
                  <Check className="w-5 h-5 text-accent-500 flex-shrink-0" />
                )}
              </button>

              <button
                type="button"
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  form.visibility === 'reader_community'
                    ? 'border-accent-300 dark:border-accent-700 bg-accent-50 dark:bg-accent-900/10'
                    : 'border-ink-100 dark:border-ink-800 hover:border-ink-200 dark:hover:border-ink-700'
                }`}
                onClick={() =>
                  setForm({
                    ...form,
                    visibility: 'reader_community' as ScreenplayVisibility,
                  })
                }
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    form.visibility === 'reader_community'
                      ? 'bg-accent-100 dark:bg-accent-900/30'
                      : 'bg-ink-100 dark:bg-ink-800'
                  }`}
                >
                  <Eye className="w-5 h-5 text-accent-500" />
                </div>

                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink-900 dark:text-white">
                    Reader Community
                  </div>

                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                    Available to approved community readers. Appears in
                    discovery and can receive reviews.
                  </div>
                </div>

                {form.visibility === 'reader_community' && (
                  <Check className="w-5 h-5 text-accent-500 flex-shrink-0" />
                )}
              </button>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-ink-500 dark:text-ink-400">
              By submitting your screenplay, you agree to Scrinit&apos;s
              Content Policy. Scrinit will upload the PDF, validate the title
              page and anonymity requirements, and save the screenplay if
              validation succeeds.
            </p>
          </Card>

          {submissionError && (
            <div
              role="alert"
              className="px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{submissionError}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!canSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading and validating screenplay...
              </>
            ) : (
              'Submit Screenplay'
            )}
          </Button>
        </div>
      </form>

      <EligibilityModal
        open={eligibilityModalOpen}
        onClose={() => setEligibilityModalOpen(false)}
      />

      <ContentPolicyModal
        open={contentPolicyModalOpen}
        onClose={() => setContentPolicyModalOpen(false)}
      />
    </>
  );
}