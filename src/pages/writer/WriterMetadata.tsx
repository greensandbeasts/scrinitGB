import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Check, AlertCircle, Loader2, Save, ChevronDown,
  Search, X, Tag as TagIcon, Globe, Languages, Eye, Lock,
  FileText, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Screenplay, ScreenplayVisibility } from '@/lib/types';
import {
  FORMAT_OPTIONS,
  GENRE_OPTIONS,
  THEME_OPTIONS,
  SETTING_OPTIONS,
  TIME_PERIOD_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  BUDGET_RANGE_OPTIONS,
  COUNTRY_OPTIONS,
  LANGUAGE_OPTIONS,
  type CountryOption,
  type LanguageOption,
} from '@/lib/lookups';

interface WriterMetadataProps {
  screenplayId: string;
  navigate: (to: string) => void;
}

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

interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: typeof Globe;
  disabled?: boolean;
}

function SearchableSelect({ options, value, onChange, placeholder, icon: Icon, disabled }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-left transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-ink-300 dark:hover:border-ink-600 cursor-pointer'
        } ${selected ? 'text-ink-900 dark:text-white' : 'text-ink-400 dark:text-ink-500'}`}
      >
        {Icon && <Icon className="w-4 h-4 flex-shrink-0 text-ink-400" />}
        <span className="flex-1 truncate text-sm">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 shadow-xl overflow-hidden animate-slide-down">
            <div className="p-2 border-b border-ink-100 dark:border-ink-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-ink-400 text-center">No results found</div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left ${
                      opt.value === value
                        ? 'bg-ink-50 dark:bg-ink-800 text-ink-900 dark:text-white font-medium'
                        : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value && <Check className="w-4 h-4 text-accent-500 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface MultiSelectProps {
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}

function MultiSelect({ options, selected, onChange, placeholder }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-left transition-all hover:border-ink-300 dark:hover:border-ink-600"
      >
        <TagIcon className="w-4 h-4 flex-shrink-0 text-ink-400" />
        <span className="flex-1 truncate text-sm">
          {selected.length > 0 ? `${selected.length} selected` : <span className="text-ink-400 dark:text-ink-500">{placeholder}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => toggle(theme)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-ink-100 dark:bg-ink-800 text-xs text-ink-700 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700 transition-colors"
            >
              {theme}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 shadow-xl overflow-hidden animate-slide-down">
            <div className="p-2 border-b border-ink-100 dark:border-ink-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search themes..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    selected.includes(opt)
                      ? 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 font-medium'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
                  }`}
                >
                  <span>{opt}</span>
                  {selected.includes(opt) && <Check className="w-4 h-4 text-accent-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface SimpleSelectProps {
  options: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}

function SimpleSelect({ options, value, onChange, placeholder, disabled }: SimpleSelectProps) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700 transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
    </div>
  );
}

export function WriterMetadata({ screenplayId, navigate }: WriterMetadataProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tagsInput, setTagsInput] = useState('');

  const [screenplay, setScreenplay] = useState<Screenplay | null>(null);

  const [form, setForm] = useState({
    title: '',
    format_type: '' as string,
    genre: '',
    logline: '',
    language: 'en',
    secondary_genre: '' as string,
    synopsis: '',
    themes: [] as string[],
    primary_setting: '' as string,
    time_period: 'Present Day' as string,
    country: '' as string,
    target_audience: '' as string,
    budget_range: '' as string,
    tags: [] as string[],
    visibility: 'private' as ScreenplayVisibility,
  });

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('screenplays')
        .select('*')
        .eq('id', screenplayId)
        .single();

      if (error || !data) {
        setError('Could not load this screenplay.');
        setLoading(false);
        return;
      }

      const sp = data as Screenplay;
      setScreenplay(sp);
      setForm({
        title: sp.title && sp.title !== 'Untitled' ? sp.title : '',
        format_type: sp.format_type ?? '',
        genre: sp.genre && sp.genre !== 'Drama' ? sp.genre : '',
        logline: sp.logline && sp.logline !== 'No logline provided.' ? sp.logline : '',
        language: sp.language ?? 'en',
        secondary_genre: sp.secondary_genre ?? '',
        synopsis: sp.synopsis ?? '',
        themes: sp.themes ?? [],
        primary_setting: sp.primary_setting ?? '',
        time_period: sp.time_period ?? 'Present Day',
        country: sp.country ?? '',
        target_audience: sp.target_audience ?? '',
        budget_range: sp.budget_range ?? '',
        tags: sp.tags ?? [],
        visibility: sp.visibility,
      });
      setLoading(false);
    }
    load();
  }, [screenplayId]);

  const requiredFilled = form.title.trim() && form.format_type && form.genre && form.logline.trim() && form.language;

  const handleSaveDraft = async () => {
    if (!requiredFilled) {
      setError('Please fill in all required fields.');
      return;
    }
    await save(false);
  };

  const handlePublish = async () => {
    if (!requiredFilled) {
      setError('Please fill in all required fields before publishing.');
      return;
    }
    await save(true);
  };

  const save = async (publish: boolean) => {
    if (!profile) return;
    setSaving(true);
    setError(null);

    const updateData = {
      title: form.title.trim(),
      format_type: form.format_type || null,
      genre: form.genre,
      logline: form.logline.trim(),
      language: form.language,
      secondary_genre: form.secondary_genre || null,
      synopsis: form.synopsis.trim() || null,
      themes: form.themes,
      primary_setting: form.primary_setting || null,
      time_period: form.time_period || null,
      country: form.country || null,
      target_audience: form.target_audience || null,
      budget_range: form.budget_range || null,
      tags: form.tags,
      visibility: publish ? 'reader_community' as ScreenplayVisibility : form.visibility,
      status: publish ? 'published' as const : 'draft' as const,
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('screenplays')
      .update(updateData)
      .eq('id', screenplayId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (publish) {
      setPublishing(true);
      setTimeout(() => navigate(`/writer/screenplay/${screenplayId}`), 800);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const addTag = () => {
    const tag = tagsInput.trim();
    if (tag && !form.tags.includes(tag) && form.tags.length < 10) {
      setForm({ ...form, tags: [...form.tags, tag] });
      setTagsInput('');
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">
        Loading screenplay...
      </div>
    );
  }

  if (!screenplay) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <AlertCircle className="w-12 h-12 text-coral-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-2">Screenplay not found</h2>
        <Button onClick={() => navigate('/writer/screenplays')} className="mt-4">Back to screenplays</Button>
      </div>
    );
  }

  if (publishing) {
    return (
      <div className="max-w-3xl mx-auto">
        <StageIndicator currentStage={2} />
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-forest-50 dark:bg-forest-900/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-forest-600 dark:text-forest-400" />
          </div>
          <h2 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">Published to Reader Community</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">
            Your screenplay is now available to approved community readers.
          </p>
          <Loader2 className="w-5 h-5 text-ink-400 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const labelClass = 'block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5';
  const requiredMark = <span className="text-coral-500 ml-0.5">*</span>;
  const sectionTitle = 'text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-4';

  const countryOptions = COUNTRY_OPTIONS.map((c: CountryOption) => ({ value: c.code, label: c.name }));
  const languageOptions = LANGUAGE_OPTIONS.map((l: LanguageOption) => ({ value: l.code, label: l.name }));

  return (
    <div className="max-w-3xl mx-auto">
      <StageIndicator currentStage={1} />

      <button onClick={() => navigate('/writer/screenplays')} className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to screenplays
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Screenplay details</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">
          Tell readers about your screenplay. Required fields must be completed before publishing.
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {saved && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 text-forest-700 dark:text-forest-400 text-sm flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" /> Draft saved.
        </div>
      )}

      <div className="space-y-6">
        {/* Required Fields */}
        <Card className="p-6">
          <h2 className={sectionTitle}>Required</h2>

          <div className="space-y-5">
            <div>
              <label className={labelClass}>Title {requiredMark}</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Enter your screenplay title"
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700 transition-all"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Format {requiredMark}</label>
                <SimpleSelect
                  options={FORMAT_OPTIONS}
                  value={form.format_type || null}
                  onChange={(v) => setForm({ ...form, format_type: v })}
                  placeholder="Select format"
                />
              </div>
              <div>
                <label className={labelClass}>Genre {requiredMark}</label>
                <SimpleSelect
                  options={GENRE_OPTIONS}
                  value={form.genre || null}
                  onChange={(v) => setForm({ ...form, genre: v })}
                  placeholder="Select genre"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Logline {requiredMark}</label>
              <textarea
                value={form.logline}
                onChange={(e) => setForm({ ...form, logline: e.target.value })}
                placeholder="A one-sentence summary of your screenplay"
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700 transition-all resize-none"
              />
            </div>

            <div>
              <label className={labelClass}>Language {requiredMark}</label>
              <SearchableSelect
                options={languageOptions}
                value={form.language}
                onChange={(v) => setForm({ ...form, language: v })}
                placeholder="Select language"
                icon={Languages}
              />
            </div>
          </div>
        </Card>

        {/* Optional Fields */}
        <Card className="p-6">
          <h2 className={sectionTitle}>Optional</h2>

          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Secondary Genre</label>
                <SimpleSelect
                  options={GENRE_OPTIONS}
                  value={form.secondary_genre || null}
                  onChange={(v) => setForm({ ...form, secondary_genre: v })}
                  placeholder="Select secondary genre"
                />
              </div>
              <div>
                <label className={labelClass}>Primary Setting</label>
                <SimpleSelect
                  options={SETTING_OPTIONS}
                  value={form.primary_setting || null}
                  onChange={(v) => setForm({ ...form, primary_setting: v })}
                  placeholder="Select setting"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Time Period</label>
                <SimpleSelect
                  options={TIME_PERIOD_OPTIONS}
                  value={form.time_period || null}
                  onChange={(v) => setForm({ ...form, time_period: v })}
                  placeholder="Select time period"
                />
              </div>
              <div>
                <label className={labelClass}>Target Audience</label>
                <SimpleSelect
                  options={TARGET_AUDIENCE_OPTIONS}
                  value={form.target_audience || null}
                  onChange={(v) => setForm({ ...form, target_audience: v })}
                  placeholder="Select target audience"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Country</label>
                <SearchableSelect
                  options={countryOptions}
                  value={form.country || null}
                  onChange={(v) => setForm({ ...form, country: v })}
                  placeholder="Select country"
                  icon={Globe}
                />
              </div>
              <div>
                <label className={labelClass}>Budget Range</label>
                <SimpleSelect
                  options={BUDGET_RANGE_OPTIONS}
                  value={form.budget_range || null}
                  onChange={(v) => setForm({ ...form, budget_range: v })}
                  placeholder="Select budget range"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Themes</label>
              <MultiSelect
                options={THEME_OPTIONS}
                selected={form.themes}
                onChange={(v) => setForm({ ...form, themes: v })}
                placeholder="Select themes"
              />
            </div>

            <div>
              <label className={labelClass}>Synopsis</label>
              <textarea
                value={form.synopsis}
                onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                placeholder="A longer summary of your screenplay (optional)"
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700 transition-all resize-none"
              />
            </div>

            <div>
              <label className={labelClass}>Tags</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="Add a tag and press Enter"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700 transition-all"
                />
                <Button variant="secondary" onClick={addTag} disabled={!tagsInput.trim() || form.tags.length >= 10}>
                  Add
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ink-100 dark:bg-ink-800 text-xs text-ink-700 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700 transition-colors"
                    >
                      {tag}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Visibility */}
        <Card className="p-6">
          <h2 className={sectionTitle}>Visibility</h2>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, visibility: 'private' })}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                form.visibility === 'private'
                  ? 'border-ink-300 dark:border-ink-600 bg-ink-50 dark:bg-ink-800'
                  : 'border-ink-100 dark:border-ink-800 hover:border-ink-200 dark:hover:border-ink-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                form.visibility === 'private' ? 'bg-ink-200 dark:bg-ink-700' : 'bg-ink-100 dark:bg-ink-800'
              }`}>
                <Lock className="w-5 h-5 text-ink-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink-900 dark:text-white">Private</div>
                <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                  Only visible to you. Does not appear in searches or receive community reviews.
                </div>
              </div>
              {form.visibility === 'private' && <Check className="w-5 h-5 text-accent-500 flex-shrink-0" />}
            </button>

            <div className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
              form.visibility === 'reader_community'
                ? 'border-accent-300 dark:border-accent-700 bg-accent-50 dark:bg-accent-900/10'
                : 'border-ink-100 dark:border-ink-800'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                form.visibility === 'reader_community' ? 'bg-accent-100 dark:bg-accent-900/30' : 'bg-ink-100 dark:bg-ink-800'
              }`}>
                <Eye className="w-5 h-5 text-accent-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink-900 dark:text-white">Reader Community</div>
                <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                  Available to approved community readers. Appears in discovery and can receive reviews.
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sticky bottom-4 bg-ink-50/80 dark:bg-ink-950/80 backdrop-blur-xl p-3 rounded-2xl border border-ink-100 dark:border-ink-800">
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={saving || !requiredFilled}
            className="w-full sm:w-auto"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save as private
          </Button>
          <Button
            onClick={handlePublish}
            disabled={saving || !requiredFilled}
            className="w-full sm:flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Publish to Reader Community
          </Button>
        </div>

        {!requiredFilled && (
          <p className="text-xs text-ink-400 dark:text-ink-500 text-center flex items-center justify-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Complete all required fields to enable saving and publishing.
          </p>
        )}
      </div>
    </div>
  );
}
