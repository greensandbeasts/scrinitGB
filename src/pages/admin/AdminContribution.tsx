import { useEffect, useState } from 'react';
import {
  Settings, Save, History, Zap, Clock, FileText, Sparkles, Award,
  Shield, ChevronDown, ChevronUp, Loader2, Check, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { type ContributionAlgorithmVersion, relativeTime } from '@/lib/types';

export function AdminContribution({ navigate: _navigate }: { navigate: (to: string) => void }) {
  const { profile } = useAuth();
  const [versions, setVersions] = useState<ContributionAlgorithmVersion[]>([]);
  const [activeConfig, setActiveConfig] = useState<ContributionAlgorithmVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('contribution_algorithm_versions')
        .select('*')
        .order('version_number', { ascending: false });
      const versions = (data as ContributionAlgorithmVersion[]) ?? [];
      setVersions(versions);
      const active = versions.find(v => v.is_active) ?? versions[0] ?? null;
      setActiveConfig(active);
      if (active) {
        setForm({
          points_per_credit: active.points_per_credit,
          page_points_enabled: active.page_points_enabled,
          points_per_page: active.points_per_page,
          time_points_enabled: active.time_points_enabled,
          minutes_per_point: active.minutes_per_point,
          max_time_contribution: active.max_time_contribution,
          inactivity_timeout_seconds: active.inactivity_timeout_seconds,
          feedback_bonus_enabled: active.feedback_bonus_enabled,
          feedback_starting_bonus: active.feedback_starting_bonus,
          feedback_reduction_rate: active.feedback_reduction_rate,
          feedback_reduction_amount: active.feedback_reduction_amount,
          feedback_min_bonus: active.feedback_min_bonus,
          feedback_min_chars: active.feedback_min_chars,
          feedback_max_chars: active.feedback_max_chars,
          ai_quality_enabled: active.ai_quality_enabled,
          ai_quality_threshold: active.ai_quality_threshold,
          ai_quality_weighting: active.ai_quality_weighting,
          completion_bonus_enabled: active.completion_bonus_enabled,
          completion_bonus_points: active.completion_bonus_points,
          max_contribution_per_screenplay: active.max_contribution_per_screenplay,
          analytics_enabled: active.analytics_enabled,
          weight_full: active.weight_full,
          weight_reduced: active.weight_reduced,
          weight_low: active.weight_low,
          weight_excluded: active.weight_excluded,
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const updateField = (field: string, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);

    const configJson = JSON.stringify(form);
    const { data, error: rpcError } = await supabase.rpc('create_algorithm_version', {
      p_activated_by: profile.id,
      p_config: configJson as unknown as Record<string, unknown>,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    // Reload versions
    const { data: newVersions } = await supabase
      .from('contribution_algorithm_versions')
      .select('*')
      .order('version_number', { ascending: false });
    setVersions((newVersions as ContributionAlgorithmVersion[]) ?? []);
    const newActive = (newVersions as ContributionAlgorithmVersion[])?.find(v => v.is_active);
    if (newActive) setActiveConfig(newActive);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
    void data;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Reader Contribution</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1">Configure contribution points, upload credits, and analytics reliability.</p>
        </div>
        <div className="flex items-center gap-3">
          {activeConfig && (
            <Badge color="ink">Version {activeConfig.version_number} · Active</Badge>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> :
             saved ? <><Check className="w-4 h-4" /> Saved</> :
             <><Save className="w-4 h-4" /> Save new version</>}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 text-forest-700 dark:text-forest-400 text-sm animate-fade-in">
          <Check className="w-4 h-4" /> New algorithm version created. Previous versions are preserved.
        </div>
      )}

      {/* Upload Credits */}
      <ConfigSection icon={<Zap className="w-5 h-5 text-accent-500" />} title="Contribution Credits" desc="How many points are needed per upload credit">
        <ConfigNumber label="Points per upload credit" value={form.points_per_credit as number} onChange={(v) => updateField('points_per_credit', v)} />
      </ConfigSection>

      {/* Page Contribution */}
      <ConfigSection icon={<FileText className="w-5 h-5 text-sea-500" />} title="Page Contribution" desc="Points earned per verified page read">
        <ConfigToggle label="Enable page points" value={form.page_points_enabled as boolean} onChange={(v) => updateField('page_points_enabled', v)} />
        <ConfigNumber label="Points per page" value={form.points_per_page as number} onChange={(v) => updateField('points_per_page', v)} step={0.5} />
      </ConfigSection>

      {/* Reading Time */}
      <ConfigSection icon={<Clock className="w-5 h-5 text-forest-500" />} title="Reading Time Contribution" desc="Points from active reading time only">
        <ConfigToggle label="Enable time points" value={form.time_points_enabled as boolean} onChange={(v) => updateField('time_points_enabled', v)} />
        <ConfigNumber label="Minutes per point" value={form.minutes_per_point as number} onChange={(v) => updateField('minutes_per_point', v)} step={0.5} />
        <ConfigNumber label="Maximum time contribution (points)" value={form.max_time_contribution as number} onChange={(v) => updateField('max_time_contribution', v)} />
        <ConfigNumber label="Inactivity timeout (seconds)" value={form.inactivity_timeout_seconds as number} onChange={(v) => updateField('inactivity_timeout_seconds', v)} />
      </ConfigSection>

      {/* Feedback Contribution */}
      <ConfigSection icon={<FileText className="w-5 h-5 text-coral-500" />} title="Feedback Contribution" desc="Bonus points for written feedback (earlier stops = more valuable)">
        <ConfigToggle label="Enable feedback bonus" value={form.feedback_bonus_enabled as boolean} onChange={(v) => updateField('feedback_bonus_enabled', v)} />
        <ConfigNumber label="Starting bonus (page 3)" value={form.feedback_starting_bonus as number} onChange={(v) => updateField('feedback_starting_bonus', v)} />
        <ConfigNumber label="Reduction rate (every N pages)" value={form.feedback_reduction_rate as number} onChange={(v) => updateField('feedback_reduction_rate', v)} />
        <ConfigNumber label="Reduction amount (points)" value={form.feedback_reduction_amount as number} onChange={(v) => updateField('feedback_reduction_amount', v)} />
        <ConfigNumber label="Minimum bonus" value={form.feedback_min_bonus as number} onChange={(v) => updateField('feedback_min_bonus', v)} />
        <ConfigNumber label="Minimum feedback characters" value={form.feedback_min_chars as number} onChange={(v) => updateField('feedback_min_chars', v)} />
        <ConfigNumber label="Maximum feedback characters" value={form.feedback_max_chars as number} onChange={(v) => updateField('feedback_max_chars', v)} />
      </ConfigSection>

      {/* AI Feedback Quality */}
      <ConfigSection icon={<Sparkles className="w-5 h-5 text-accent-500" />} title="AI Feedback Quality" desc="AI-assisted analysis of feedback quality">
        <ConfigToggle label="Enable AI quality analysis" value={form.ai_quality_enabled as boolean} onChange={(v) => updateField('ai_quality_enabled', v)} />
        <ConfigNumber label="Quality threshold (0-1)" value={form.ai_quality_threshold as number} onChange={(v) => updateField('ai_quality_threshold', v)} step={0.05} />
        <ConfigNumber label="Quality weighting (0-1)" value={form.ai_quality_weighting as number} onChange={(v) => updateField('ai_quality_weighting', v)} step={0.05} />
      </ConfigSection>

      {/* Completion Bonus */}
      <ConfigSection icon={<Award className="w-5 h-5 text-forest-500" />} title="Completion Bonus" desc="Bonus points for completing a screenplay">
        <ConfigToggle label="Enable completion bonus" value={form.completion_bonus_enabled as boolean} onChange={(v) => updateField('completion_bonus_enabled', v)} />
        <ConfigNumber label="Completion bonus points" value={form.completion_bonus_points as number} onChange={(v) => updateField('completion_bonus_points', v)} />
        <ConfigNumber label="Max contribution per screenplay" value={form.max_contribution_per_screenplay as number} onChange={(v) => updateField('max_contribution_per_screenplay', v)} />
      </ConfigSection>

      {/* Analytics Reliability */}
      <ConfigSection icon={<Shield className="w-5 h-5 text-sea-500" />} title="Analytics Reliability" desc="Weight values and integrity checks for engagement data quality">
        <ConfigToggle label="Enable analytics weighting" value={form.analytics_enabled as boolean} onChange={(v) => updateField('analytics_enabled', v)} />
        <ConfigNumber label="Full weight" value={form.weight_full as number} onChange={(v) => updateField('weight_full', v)} step={0.05} />
        <ConfigNumber label="Reduced weight" value={form.weight_reduced as number} onChange={(v) => updateField('weight_reduced', v)} step={0.05} />
        <ConfigNumber label="Low confidence weight" value={form.weight_low as number} onChange={(v) => updateField('weight_low', v)} step={0.05} />
        <ConfigNumber label="Excluded weight" value={form.weight_excluded as number} onChange={(v) => updateField('weight_excluded', v)} step={0.05} />
      </ConfigSection>

      {/* Version History */}
      <Card className="p-6">
        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Algorithm Version History</h2>
            <Badge color="ink">{versions.length} versions</Badge>
          </div>
          {showHistory ? <ChevronUp className="w-4 h-4 text-ink-400" /> : <ChevronDown className="w-4 h-4 text-ink-400" />}
        </button>
        {showHistory && (
          <div className="mt-4 space-y-2 animate-slide-down">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-4 py-3 border-b border-ink-50 dark:border-ink-800 last:border-0">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-ink-900 dark:text-white tabular-nums">v{v.version_number}</span>
                  {v.is_active && <Badge color="forest">Active</Badge>}
                </div>
                <div className="flex-1 min-w-0 text-sm text-ink-500 dark:text-ink-400">
                  {v.points_per_credit} pts/credit · {v.points_per_page} pts/page · {v.inactivity_timeout_seconds}s timeout
                </div>
                <div className="text-xs text-ink-400 dark:text-ink-500">
                  {relativeTime(v.activated_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ConfigSection({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-ink-50 dark:bg-ink-800 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">{title}</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400">{desc}</p>
        </div>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </Card>
  );
}

function ConfigToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-ink-700 dark:text-ink-300">{label}</label>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-forest-500' : 'bg-ink-200 dark:bg-ink-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function ConfigNumber({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm font-medium text-ink-700 dark:text-ink-300">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-28 px-3 py-2 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all"
      />
    </div>
  );
}
