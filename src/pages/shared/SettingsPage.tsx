import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Check, User as UserIcon, Bell, Shield, PenTool, Eye, Building2, Plus, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { supabase } from '@/lib/supabase';
import type { SelectableRole, ThemePreference, IndustryProfile, IndustryType } from '@/lib/types';
import { SELECTABLE_ROLE_LABELS, INDUSTRY_VERIFICATION_LABELS } from '@/lib/types';

interface SettingsPageProps {
  navigate: (to: string) => void;
}

const ROLE_ICONS: Record<SelectableRole, typeof UserIcon> = {
  writer: PenTool,
  reader: Eye,
  industry: Building2,
};

const ALL_ROLES: SelectableRole[] = ['writer', 'reader', 'industry'];

export function SettingsPage({ navigate }: SettingsPageProps) {
  const { profile, userRoles, activeRole, enableRole, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [enablingRole, setEnablingRole] = useState<SelectableRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [industryProfile, setIndustryProfile] = useState<IndustryProfile | null>(null);
  const [showIndustryOnboarding, setShowIndustryOnboarding] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? '');
      setCountry(profile.country ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (userRoles.includes('industry') && profile) {
      supabase
        .from('industry_profiles')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setIndustryProfile(data as IndustryProfile);
        });
    }
  }, [userRoles, profile]);

  if (!profile) return null;

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      display_name: displayName,
      bio: bio || null,
      country: country || null,
    });
    setSaving(false);
    if (!error) {
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    }
  };

  const handleThemeChange = async (newTheme: ThemePreference) => {
    setTheme(newTheme);
    await updateProfile({ preferred_theme: newTheme });
  };

  const handleEnableRole = async (role: SelectableRole) => {
    setRoleError(null);
    if (role === 'industry') {
      setShowIndustryOnboarding(true);
      return;
    }
    setEnablingRole(role);
    const { error } = await enableRole(role);
    setEnablingRole(null);
    if (error) setRoleError(error);
  };

  const handleIndustryOnboardingComplete = async () => {
    setShowIndustryOnboarding(false);
    setEnablingRole('industry');
    const { error } = await enableRole('industry');
    setEnablingRole(null);
    if (error) {
      setRoleError(error);
    } else {
      // Reload industry profile
      if (profile) {
        const { data } = await supabase
          .from('industry_profiles')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();
        if (data) setIndustryProfile(data as IndustryProfile);
      }
    }
  };

  const themeOptions: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Manage your account, roles, and preferences.</p>
      </div>

      {/* Profile section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <UserIcon className="w-5 h-5 text-ink-400" />
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Shared profile</h2>
        </div>
        <div className="flex items-start gap-4 mb-6">
          <Avatar name={profile.display_name} color={profile.avatar_color} size="lg" />
          <div className="flex-1">
            <div className="text-sm text-ink-500 dark:text-ink-400 mb-1">Email</div>
            <div className="text-sm font-medium text-ink-900 dark:text-ink-100">{profile.email}</div>
            <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">Email cannot be changed here.</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United States"
              className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Biography</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Tell the community about yourself..."
            className="w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all resize-none"
          />
        </div>
        <div className="flex items-center gap-3 mt-5">
          <Button onClick={handleSaveProfile} disabled={saving || displayName.trim() === ''}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save changes
          </Button>
          {savedMessage && (
            <span className="text-sm text-forest-600 dark:text-forest-400 flex items-center gap-1 animate-fade-in">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </Card>

      {/* Appearance section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Sun className="w-5 h-5 text-ink-400" />
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Appearance</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">Your theme preference is saved to your account and syncs across devices after sign-in.</p>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleThemeChange(opt.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? 'border-ink-900 dark:border-white bg-ink-50 dark:bg-ink-800'
                    : 'border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-ink-900 dark:text-white' : 'text-ink-400'}`} />
                <span className={`text-sm font-medium ${isActive ? 'text-ink-900 dark:text-white' : 'text-ink-500 dark:text-ink-400'}`}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* My Roles section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-5 h-5 text-ink-400" />
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">My roles</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">Enable additional roles to switch between perspectives without creating a new account.</p>
        {roleError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm">
            {roleError}
          </div>
        )}
        <div className="space-y-3">
          {ALL_ROLES.map((role) => {
            const Icon = ROLE_ICONS[role];
            const enabled = userRoles.includes(role);
            const isActiveRole = activeRole === role;
            return (
              <div
                key={role}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  enabled
                    ? 'border-ink-200 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/50'
                    : 'border-dashed border-ink-200 dark:border-ink-700'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  enabled ? 'bg-ink-900 dark:bg-ink-100' : 'bg-ink-100 dark:bg-ink-800'
                }`}>
                  <Icon className={`w-5 h-5 ${enabled ? 'text-white dark:text-ink-900' : 'text-ink-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">{SELECTABLE_ROLE_LABELS[role]}</span>
                    {isActiveRole && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 font-medium uppercase tracking-wider">Active</span>
                    )}
                    {role === 'industry' && enabled && industryProfile && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                        industryProfile.verification_status === 'verified'
                          ? 'bg-forest-100 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400'
                          : 'bg-ink-100 dark:bg-ink-800 text-ink-500'
                      }`}>
                        {INDUSTRY_VERIFICATION_LABELS[industryProfile.verification_status]}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                    {enabled
                      ? role === 'industry' && industryProfile?.verification_status !== 'verified'
                        ? 'Verification required before full access'
                        : 'Enabled'
                      : 'Not enabled'}
                  </div>
                </div>
                {!enabled && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEnableRole(role)}
                    disabled={enablingRole !== null}
                  >
                    {enablingRole === role ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Enable
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Notifications section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Bell className="w-5 h-5 text-ink-400" />
          <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Notifications</h2>
        </div>
        <NotificationPrefs />
      </Card>

      {/* Industry onboarding modal */}
      {showIndustryOnboarding && (
        <IndustryOnboardingModal
          onClose={() => setShowIndustryOnboarding(false)}
          onComplete={handleIndustryOnboardingComplete}
          profileId={profile.id}
        />
      )}
    </div>
  );
}

function NotificationPrefs() {
  const { profile, updateProfile } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(profile?.notification_preferences ?? { email: true, assignments: true, requests: true });
  const [saving, setSaving] = useState(false);

  const toggle = async (key: string) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(true);
    await updateProfile({ notification_preferences: newPrefs });
    setSaving(false);
  };

  const items = [
    { key: 'email', label: 'Email notifications', desc: 'Receive important updates via email' },
    { key: 'assignments', label: 'Reading assignments', desc: 'When new screenplays are assigned to you' },
    { key: 'requests', label: 'Introduction requests', desc: 'When industry professionals request access' },
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm font-medium text-ink-900 dark:text-ink-100">{item.label}</div>
            <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{item.desc}</div>
          </div>
          <button
            onClick={() => toggle(item.key)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              prefs[item.key] ? 'bg-ink-900 dark:bg-ink-100' : 'bg-ink-200 dark:bg-ink-700'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-ink-900 shadow-sm transition-transform ${
              prefs[item.key] ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Industry Onboarding Modal
// ──────────────────────────────────────────────────────────────────────────
function IndustryOnboardingModal({
  onClose,
  onComplete,
  profileId,
}: {
  onClose: () => void;
  onComplete: () => void;
  profileId: string;
}) {
  const [step, setStep] = useState<'choose' | 'company' | 'independent'>('choose');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Company form
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [industryRole, setIndustryRole] = useState('');
  const [country, setCountry] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [imdb, setImdb] = useState('');
  const [bio, setBio] = useState('');

  // Independent form
  const [profession, setProfession] = useState('');
  const [indCountry, setIndCountry] = useState('');
  const [indImdb, setIndImdb] = useState('');
  const [indWebsite, setIndWebsite] = useState('');
  const [indLinkedin, setIndLinkedin] = useState('');
  const [indBio, setIndBio] = useState('');

  const handleCompanySubmit = async () => {
    if (!fullName || !jobTitle || !companyName || !companyWebsite || !companyEmail || !industryRole || !country) {
      setError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('industry_profiles').upsert({
      user_id: profileId,
      industry_type: 'company_representative',
      job_title: jobTitle,
      company_name: companyName,
      company_website: companyWebsite,
      company_email: companyEmail,
      company_email_verified: false,
      profession: industryRole,
      country: country,
      linkedin_url: linkedin || null,
      imdb_url: imdb || null,
      verification_status: 'pending',
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onComplete();
  };

  const handleIndependentSubmit = async () => {
    if (!fullName || !profession || !indCountry) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!indImdb && !indWebsite) {
      setError('Please provide at least an IMDb profile or a professional website.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('industry_profiles').upsert({
      user_id: profileId,
      industry_type: 'independent_professional',
      profession: profession,
      country: indCountry,
      imdb_url: indImdb || null,
      professional_website: indWebsite || null,
      linkedin_url: indLinkedin || null,
      verification_status: 'pending',
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onComplete();
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600 transition-all';
  const labelClass = 'block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-ink-900 border-b border-ink-100 dark:border-ink-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white">Enable Industry role</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'choose' && (
            <div className="space-y-4">
              <p className="text-sm text-ink-500 dark:text-ink-400 mb-6">Industry professionals require verification. Choose your path to get started.</p>
              <button
                onClick={() => setStep('company')}
                className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-ink-900 dark:bg-ink-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-white dark:text-ink-900" />
                </div>
                <div>
                  <div className="font-semibold text-ink-900 dark:text-white">Company Representative</div>
                  <div className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">You represent a production company, agency, studio, or management firm.</div>
                </div>
              </button>
              <button
                onClick={() => setStep('independent')}
                className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-ink-900 dark:bg-ink-100 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-white dark:text-ink-900" />
                </div>
                <div>
                  <div className="font-semibold text-ink-900 dark:text-white">Independent Professional</div>
                  <div className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">You work independently as a producer, director, agent, or executive.</div>
                </div>
              </button>
            </div>
          )}

          {step === 'company' && (
            <div className="space-y-4">
              <button onClick={() => setStep('choose')} className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors mb-2">
                ← Back
              </button>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <label className={labelClass}>Job Title *</label>
                  <input className={inputClass} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Development Executive" />
                </div>
                <div>
                  <label className={labelClass}>Company Name *</label>
                  <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Northbound Pictures" />
                </div>
                <div>
                  <label className={labelClass}>Company Website *</label>
                  <input className={inputClass} value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className={labelClass}>Company Email *</label>
                  <input className={inputClass} type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div>
                  <label className={labelClass}>Industry Role *</label>
                  <select className={inputClass} value={industryRole} onChange={(e) => setIndustryRole(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="producer">Producer</option>
                    <option value="development_executive">Development Executive</option>
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                    <option value="studio_executive">Studio Executive</option>
                    <option value="acquisitions">Acquisitions</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Country *</label>
                  <input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" />
                </div>
                <div>
                  <label className={labelClass}>LinkedIn</label>
                  <input className={inputClass} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div>
                <label className={labelClass}>IMDb</label>
                <input className={inputClass} value={imdb} onChange={(e) => setImdb(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className={labelClass}>Biography</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Optional" />
              </div>
              <p className="text-xs text-ink-400 dark:text-ink-500">The Industry role will be activated after company email verification.</p>
              {error && <div className="px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm">{error}</div>}
              <Button onClick={handleCompanySubmit} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                Submit for verification
              </Button>
            </div>
          )}

          {step === 'independent' && (
            <div className="space-y-4">
              <button onClick={() => setStep('choose')} className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors mb-2">
                ← Back
              </button>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <label className={labelClass}>Profession *</label>
                  <select className={inputClass} value={profession} onChange={(e) => setProfession(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="producer">Producer</option>
                    <option value="director">Director</option>
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                    <option value="executive">Executive</option>
                    <option value="financier">Financier</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Country *</label>
                  <input className={inputClass} value={indCountry} onChange={(e) => setIndCountry(e.target.value)} placeholder="e.g. United States" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>IMDb Profile</label>
                  <input className={inputClass} value={indImdb} onChange={(e) => setIndImdb(e.target.value)} placeholder="https://www.imdb.com/..." />
                </div>
                <div>
                  <label className={labelClass}>Professional Website</label>
                  <input className={inputClass} value={indWebsite} onChange={(e) => setIndWebsite(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <p className="text-xs text-ink-400 dark:text-ink-500">At least one of IMDb profile or professional website is required.</p>
              <div>
                <label className={labelClass}>LinkedIn</label>
                <input className={inputClass} value={indLinkedin} onChange={(e) => setIndLinkedin(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className={labelClass}>Biography</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={indBio} onChange={(e) => setIndBio(e.target.value)} placeholder="Optional" />
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-coral-50 dark:bg-coral-900/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-400 text-sm">{error}</div>}
              <Button onClick={handleIndependentSubmit} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserIcon className="w-4 h-4" />}
                Submit for verification
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
