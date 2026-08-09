import { useEffect, useState } from 'react';
import { Settings, Save, Users, BookOpen, TrendingUp, Upload, Shield, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { PlatformSettings } from '@/lib/types';

interface AdminSettingsProps {
  navigate: (to: string) => void;
}

export function AdminSettings({ navigate: _navigate }: AdminSettingsProps) {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    writers: 0,
    readers: 0,
    industry: 0,
    screenplays: 0,
    published: 0,
    qualified: 0,
    assignments: 0,
    completed: 0,
    industryReads: 0,
    introRequests: 0,
  });

  useEffect(() => {
    async function load() {
      const [settingsRes, usersRes, writersRes, readersRes, industryRes, spRes, pubRes, qualRes, assignRes, compRes, indReadsRes, introReqRes] = await Promise.all([
        supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'writer'),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'reader'),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'industry'),
        supabase.from('screenplays').select('id', { count: 'exact', head: true }),
        supabase.from('screenplays').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('screenplays').select('id', { count: 'exact', head: true }).eq('industry_qualified', true),
        supabase.from('assignments').select('id', { count: 'exact', head: true }),
        supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('industry_reading_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('industry_requests').select('id', { count: 'exact', head: true }),
      ]);

      setSettings(settingsRes.data as PlatformSettings | null);
      setStats({
        totalUsers: usersRes.count ?? 0,
        writers: writersRes.count ?? 0,
        readers: readersRes.count ?? 0,
        industry: industryRes.count ?? 0,
        screenplays: spRes.count ?? 0,
        published: pubRes.count ?? 0,
        qualified: qualRes.count ?? 0,
        assignments: assignRes.count ?? 0,
        completed: compRes.count ?? 0,
        industryReads: indReadsRes.count ?? 0,
        introRequests: introReqRes.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('platform_settings')
      .update({
        min_completed_assignments: settings.min_completed_assignments,
        min_recommendations: settings.min_recommendations,
        min_confidence_level: settings.min_confidence_level,
        mature_dataset_threshold: settings.mature_dataset_threshold,
        priority_reduction_threshold: settings.priority_reduction_threshold,
        max_upload_mb: settings.max_upload_mb,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const updateField = (field: keyof PlatformSettings, value: number | string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value } as PlatformSettings);
  };

  if (loading || !settings) {
    return <div className="flex items-center justify-center h-64 text-sm text-ink-400 dark:text-ink-500 animate-pulse">Loading settings...</div>;
  }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all';
  const labelClass = 'block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5';
  const descClass = 'text-xs text-ink-400 dark:text-ink-500 mt-1';

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Platform Settings</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Control qualification thresholds, assignment lifecycle, and platform parameters.</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {saved && (
        <div className="px-4 py-3 rounded-xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 text-forest-700 dark:text-forest-400 text-sm flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" /> Settings saved successfully.
        </div>
      )}

      {/* Platform Stats Overview */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-5 h-5 text-ink-400" />
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Platform overview</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Total users" value={stats.totalUsers} />
          <StatBox label="Writers" value={stats.writers} />
          <StatBox label="Readers" value={stats.readers} />
          <StatBox label="Industry" value={stats.industry} />
          <StatBox label="Screenplays" value={stats.screenplays} />
          <StatBox label="Published" value={stats.published} />
          <StatBox label="Qualified" value={stats.qualified} />
          <StatBox label="Assignments" value={stats.assignments} />
          <StatBox label="Completed" value={stats.completed} />
          <StatBox label="Industry reads" value={stats.industryReads} />
          <StatBox label="Intro requests" value={stats.introRequests} />
          <StatBox label="Completion rate" value={stats.assignments > 0 ? `${Math.round((stats.completed / stats.assignments) * 100)}%` : '0%'} />
        </div>
      </Card>

      {/* Industry Qualification Thresholds */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-5 h-5 text-ink-400" />
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Industry qualification thresholds</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-5">Screenplays automatically become available in Industry Discovery when all of these conditions are met.</p>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Minimum completed reader assignments</label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.min_completed_assignments}
              onChange={(e) => updateField('min_completed_assignments', parseInt(e.target.value) || 0)}
              className={inputClass}
            />
            <p className={descClass}>Only completed assignments (reading + feedback) count toward qualification.</p>
          </div>

          <div>
            <label className={labelClass}>Minimum reader recommendations</label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.min_recommendations}
              onChange={(e) => updateField('min_recommendations', parseInt(e.target.value) || 0)}
              className={inputClass}
            />
            <p className={descClass}>Number of readers who recommended the screenplay.</p>
          </div>

          <div>
            <label className={labelClass}>Minimum confidence level</label>
            <select
              value={settings.min_confidence_level}
              onChange={(e) => updateField('min_confidence_level', e.target.value)}
              className={inputClass}
            >
              <option value="low">Low (25+ score)</option>
              <option value="moderate">Moderate (25+ score)</option>
              <option value="strong">Strong (50+ score)</option>
              <option value="high">High (75+ score)</option>
            </select>
            <p className={descClass}>Based on reader volume, completion rate, and feedback count.</p>
          </div>

          <div>
            <label className={labelClass}>Maximum upload size (MB)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.max_upload_mb}
              onChange={(e) => updateField('max_upload_mb', parseInt(e.target.value) || 25)}
              className={inputClass}
            />
            <p className={descClass}>Maximum PDF file size for screenplay uploads.</p>
          </div>
        </div>
      </Card>

      {/* Assignment Lifecycle Thresholds */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="w-5 h-5 text-ink-400" />
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Assignment lifecycle thresholds</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-5">Control how reader assignments scale as screenplays mature.</p>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Mature dataset threshold</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={settings.mature_dataset_threshold}
              onChange={(e) => updateField('mature_dataset_threshold', parseInt(e.target.value) || 30)}
              className={inputClass}
            />
            <p className={descClass}>When a screenplay reaches this many completed assignments, the writer is notified and may pause future assignments.</p>
          </div>

          <div>
            <label className={labelClass}>Priority reduction threshold</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={settings.priority_reduction_threshold}
              onChange={(e) => updateField('priority_reduction_threshold', parseInt(e.target.value) || 100)}
              className={inputClass}
            />
            <p className={descClass}>After this many completed assignments, reader assignment weighting is automatically reduced. New screenplays get priority.</p>
          </div>
        </div>

        {/* Visual threshold guide */}
        <div className="mt-6 pt-6 border-t border-ink-100 dark:border-ink-800">
          <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-3">Assignment lifecycle</div>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge color="slate">Phase 1: Private</Badge>
            <span className="text-ink-300 dark:text-ink-600">→</span>
            <Badge color="sea">Phase 2: Readers Only</Badge>
            <span className="text-ink-300 dark:text-ink-600">→</span>
            <Badge color="accent">Phase 3: Industry Qualified</Badge>
            <span className="text-ink-300 dark:text-ink-600">→</span>
            <Badge color="forest">Phase 4: Mature ({settings.mature_dataset_threshold}+)</Badge>
            <span className="text-ink-300 dark:text-ink-600">→</span>
            <Badge color="coral">Phase 5: Priority Reduction ({settings.priority_reduction_threshold}+)</Badge>
          </div>
        </div>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3 sticky bottom-4">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save all settings
        </Button>
        {saved && (
          <span className="text-sm text-forest-600 dark:text-forest-400 flex items-center gap-1 animate-fade-in">
            <Check className="w-3.5 h-3.5" /> All changes saved
          </span>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-3">
      <div className="text-xs text-ink-400 dark:text-ink-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold text-ink-900 dark:text-white tabular-nums">{value}</div>
    </div>
  );
}
