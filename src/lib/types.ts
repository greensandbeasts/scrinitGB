export type UserRole = 'writer' | 'reader' | 'industry' | 'admin';
export type SelectableRole = 'writer' | 'reader' | 'industry';
export type ThemePreference = 'light' | 'dark' | 'system';
export type IndustryVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type IndustryType = 'company_representative' | 'independent_professional';
export type ScreenplayStatus = 'draft' | 'published' | 'archived';
export type LifecycleStatus = 'active' | 'optioned' | 'purchased' | 'in_development' | 'in_production' | 'available_to_watch' | 'archived';
export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'abandoned' | 'expired';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';
export type ContinueDecision = 'continue' | 'stop';
export type FeedbackCompletion = 'completed' | 'partially_read' | 'stopped_early';
export type RequestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn';
export type ScreenplayVisibility = 'private' | 'readers_only' | 'industry_qualified' | 'reader_community';
export type IndustryAccessSetting = 'open_to_verified' | 'request_approval' | 'private';
export type IndustryRequestType = 'reading_access' | 'introduction';
export type ReaderMode = 'reader' | 'industry';
export type ContributionSource = 'pages' | 'time' | 'feedback' | 'completion' | 'bonus' | 'adjustment';
export type CreditType = 'free' | 'earned' | 'spent';
export type AnalyticsWeightLevel = 'full' | 'reduced' | 'low' | 'excluded';
export type ReliabilityFlagType =
  | 'rapid_scrolling' | 'impossible_progression' | 'browser_automation'
  | 'copy_paste_feedback' | 'ai_generated_feedback' | 'identical_reviews'
  | 'excessive_inactivity' | 'session_padding';
export type StopReason =
  | 'didnt_hook_me' | 'lost_interest' | 'confusing' | 'pacing'
  | 'dialogue' | 'characters' | 'formatting' | 'not_my_genre' | 'other';
export type RecommendChoice = 'recommend' | 'consider' | 'pass';

export type LineType = 'h' | 'a' | 'c' | 'd' | 'p' | 't';

export interface ScreenplayLine {
  t: LineType;
  x: string;
}

export type ScreenplayPage = ScreenplayLine[];

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  company: string | null;
  bio: string | null;
  avatar_color: string | null;
  preferred_theme: ThemePreference;
  last_active_role: UserRole | null;
  country: string | null;
  notification_preferences: Record<string, boolean>;
  privacy_settings: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  suspended: boolean;
  suspended_reason: string | null;
  suspended_at: string | null;
}

export interface UserRoleEntry {
  id: string;
  user_id: string;
  role: SelectableRole;
  enabled_at: string;
}

export interface WriterProfile {
  id: string;
  user_id: string;
  genres: string[];
  introduction_preferences: Record<string, unknown>;
  submission_stats: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReaderProfile {
  id: string;
  user_id: string;
  reading_preferences: Record<string, unknown>;
  achievements: unknown[];
  reputation_score: number;
  contribution_count: number;
  created_at: string;
  updated_at: string;
}

export interface IndustryProfile {
  id: string;
  user_id: string;
  verification_status: IndustryVerificationStatus;
  industry_type: IndustryType | null;
  job_title: string | null;
  company_name: string | null;
  company_website: string | null;
  company_email: string | null;
  company_email_verified: boolean;
  profession: string | null;
  linkedin_url: string | null;
  imdb_url: string | null;
  professional_website: string | null;
  country: string | null;
  discovery_preferences: Record<string, unknown>;
  watchlists: unknown[];
  created_at: string;
  updated_at: string;
}

export interface Screenplay {
  id: string;
  writer_id: string;
  title: string;
  genre: string;
  logline: string;
  synopsis: string | null;
  content: ScreenplayPage[];
  page_count: number;
  status: ScreenplayStatus;
  cover_color: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  original_pdf_path: string | null;
  anonymous_pdf_path: string | null;
  visibility: ScreenplayVisibility;
  industry_access: IndustryAccessSetting;
  industry_qualified: boolean;
  assignment_paused: boolean;
  secondary_genre: string | null;
  format_type: string | null;
  budget_range: string | null;
  themes: string[];
  primary_setting: string | null;
  time_period: string | null;
  tone: string | null;
  target_audience: string | null;
  sanitisation_notes: string | null;
  lifecycle_status: LifecycleStatus;
  archive_date: string | null;
  archive_reason: string | null;
  country: string | null;
  language: string | null;
}

export interface Assignment {
  id: string;
  screenplay_id: string;
  reader_id: string;
  status: AssignmentStatus;
  reader_number: number | null;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  contribution_awarded: boolean;
}

export interface ReadingSession {
  id: string;
  assignment_id: string;
  screenplay_id: string;
  reader_id: string;
  session_number: number;
  started_at: string;
  ended_at: string | null;
  last_page_reached: number;
  pages_read_this_session: number;
  duration_seconds: number;
  status: SessionStatus;
  decision: ContinueDecision | null;
  checkpoint_page: number | null;
  scroll_position: number | null;
  active_reading_seconds: number;
  stop_reason: string | null;
  algorithm_version_id: string | null;
}

export interface ReaderFeedback {
  id: string;
  assignment_id: string;
  screenplay_id: string;
  reader_id: string;
  would_recommend: boolean;
  overall_rating: number;
  story_rating: number;
  characters_rating: number;
  pacing_rating: number;
  dialogue_rating: number;
  written_feedback: string;
  completion_status: FeedbackCompletion;
  submitted_at: string;
  ai_quality_score: number | null;
  ai_quality_enabled: boolean;
  stop_page: number | null;
  stop_reason: string | null;
  algorithm_version_id: string | null;
}

export interface IndustryRequest {
  id: string;
  screenplay_id: string;
  industry_user_id: string;
  writer_id: string;
  status: RequestStatus;
  message: string;
  company_snapshot: string | null;
  created_at: string;
  responded_at: string | null;
  request_type: IndustryRequestType;
  reason_for_contact: string | null;
  profession_snapshot: string | null;
  identity_revealed: boolean;
  identity_fields_revealed: Record<string, boolean>;
  writer_response_message: string | null;
}

export interface ScreenplayDiscovery {
  id: string;
  title: string;
  genre: string;
  logline: string;
  synopsis: string | null;
  writer_id: string;
  writer_name: string;
  writer_company: string | null;
  cover_color: string;
  tags: string[];
  page_count: number;
  published_at: string | null;
  total_assignments: number;
  reader_count: number;
  completed_count: number;
  abandoned_count: number;
  feedback_count: number;
  recommend_count: number;
  completion_rate: number;
  recommend_rate: number;
  avg_rating: number;
  avg_story: number;
  avg_characters: number;
  avg_pacing: number;
  avg_dialogue: number;
  avg_last_page: number;
  total_sessions: number;
  return_sessions: number;
  return_rate: number;
  confidence_score: number;
  secondary_genre: string | null;
  format_type: string | null;
  budget_range: string | null;
  themes: string[];
  primary_setting: string | null;
  time_period: string | null;
  tone: string | null;
  target_audience: string | null;
  industry_qualified: boolean;
  visibility: ScreenplayVisibility;
  lifecycle_status: LifecycleStatus;
}

export interface ReaderReviewedScreenplay {
  id: string;
  title: string;
  genre: string;
  logline: string;
  synopsis: string | null;
  cover_color: string;
  tags: string[];
  page_count: number;
  published_at: string | null;
  reader_count: number;
  completed_count: number;
  feedback_count: number;
  recommend_count: number;
  completion_rate: number;
  recommend_rate: number;
  avg_rating: number;
  avg_story: number;
  avg_characters: number;
  avg_pacing: number;
  avg_dialogue: number;
  avg_last_page: number;
  total_sessions: number;
  return_sessions: number;
  return_rate: number;
  confidence_score: number;
  lifecycle_status: LifecycleStatus;
  secondary_genre: string | null;
  format_type: string | null;
  themes: string[];
  primary_setting: string | null;
  time_period: string | null;
  tone: string | null;
  target_audience: string | null;
}

export interface ScreenplayFollower {
  id: string;
  screenplay_id: string;
  reader_id: string;
  created_at: string;
}

export interface FollowerNotification {
  id: string;
  screenplay_id: string;
  follower_id: string;
  lifecycle_status: LifecycleStatus;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export interface ProjectStatusHistory {
  id: string;
  screenplay_id: string;
  previous_status: LifecycleStatus | null;
  new_status: LifecycleStatus;
  changed_by: string;
  archive_reason: string | null;
  release_info_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface ReleaseInfo {
  id: string;
  screenplay_id: string;
  streaming_platform: string | null;
  tv_broadcaster: string | null;
  cinema_release: string | null;
  official_website: string | null;
  trailer_link: string | null;
  release_date: string | null;
  created_at: string;
  updated_at: string;
}

export const LIFECYCLE_STATUS_LABELS: Record<LifecycleStatus, string> = {
  active: 'Active',
  optioned: 'Optioned',
  purchased: 'Purchased',
  in_development: 'In Development',
  in_production: 'In Production',
  available_to_watch: 'Available to Watch',
  archived: 'Archived',
};

export const LIFECYCLE_STATUS_DESCRIPTIONS: Record<LifecycleStatus, string> = {
  active: 'Available for reader assignments and industry discovery',
  optioned: 'Optioned by a production company or studio',
  purchased: 'Purchased outright',
  in_development: 'Currently in development',
  in_production: 'Currently in production',
  available_to_watch: 'Released and available to watch',
  archived: 'Archived — removed from discovery and assignments',
};

export const ARCHIVING_STATUSES: LifecycleStatus[] = ['optioned', 'purchased', 'in_development', 'in_production', 'available_to_watch'];

export interface IndustryReadingSession {
  id: string;
  screenplay_id: string;
  industry_user_id: string;
  session_number: number;
  started_at: string;
  ended_at: string | null;
  last_page_reached: number;
  pages_read_this_session: number;
  duration_seconds: number;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  screenplay_id: string | null;
  request_id: string | null;
  read: boolean;
  created_at: string;
}

export interface PlatformSettings {
  id: number;
  min_completed_assignments: number;
  min_recommendations: number;
  min_confidence_level: 'low' | 'moderate' | 'strong' | 'high';
  mature_dataset_threshold: number;
  priority_reduction_threshold: number;
  max_upload_mb: number;
}

export interface AssignmentWithScreenplay extends Assignment {
  screenplay?: Pick<Screenplay, 'id' | 'title' | 'genre' | 'logline' | 'cover_color' | 'page_count' | 'content'>;
}

export interface ContributionAlgorithmVersion {
  id: string;
  version_number: number;
  activated_at: string;
  activated_by: string | null;
  points_per_credit: number;
  page_points_enabled: boolean;
  points_per_page: number;
  time_points_enabled: boolean;
  minutes_per_point: number;
  max_time_contribution: number;
  inactivity_timeout_seconds: number;
  feedback_bonus_enabled: boolean;
  feedback_starting_bonus: number;
  feedback_reduction_rate: number;
  feedback_reduction_amount: number;
  feedback_min_bonus: number;
  feedback_min_chars: number;
  feedback_max_chars: number;
  ai_quality_enabled: boolean;
  ai_quality_threshold: number;
  ai_quality_weighting: number;
  completion_bonus_enabled: boolean;
  completion_bonus_points: number;
  max_contribution_per_screenplay: number;
  analytics_enabled: boolean;
  weight_full: number;
  weight_reduced: number;
  weight_low: number;
  weight_excluded: number;
  integrity_checks: Record<string, number>;
  exclusion_thresholds: Record<string, number>;
  is_active: boolean;
}

export interface ReaderContributionBalance {
  id: string;
  reader_id: string;
  contribution_points: number;
  upload_credits: number;
  total_credits_earned: number;
  free_upload_used: boolean;
  current_algorithm_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContributionEvent {
  id: string;
  reader_id: string;
  screenplay_id: string;
  assignment_id: string | null;
  reading_session_id: string | null;
  algorithm_version_id: string | null;
  source: ContributionSource;
  points_awarded: number;
  points_breakdown: Record<string, number>;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  reader_id: string;
  type: CreditType;
  credits: number;
  points_spent: number;
  screenplay_id: string | null;
  algorithm_version_id: string | null;
  note: string | null;
  created_at: string;
}

export interface AnalyticsWeight {
  id: string;
  reading_session_id: string;
  screenplay_id: string;
  reader_id: string;
  weight: number;
  weight_level: AnalyticsWeightLevel;
  signals: Record<string, number | boolean>;
  algorithm_version_id: string | null;
  created_at: string;
}

export interface ReliabilityFlag {
  id: string;
  reading_session_id: string;
  screenplay_id: string;
  reader_id: string;
  flag_type: ReliabilityFlagType;
  severity: 'low' | 'medium' | 'high';
  detail: Record<string, unknown>;
  admin_notified: boolean;
  created_at: string;
}

export interface FeedbackQualityScore {
  id: string;
  feedback_id: string;
  reader_id: string;
  screenplay_id: string;
  quality_score: number;
  scores: Record<string, number>;
  analysis_text: string | null;
  algorithm_version_id: string | null;
  created_at: string;
}

export interface IndustryRequestWithDetails extends IndustryRequest {
  screenplay?: Pick<Screenplay, 'id' | 'title' | 'genre' | 'cover_color'>;
  industry_user?: Pick<Profile, 'display_name' | 'company' | 'email'>;
}

export const COVER_COLORS: Record<string, { bg: string; text: string; ring: string; gradient: string }> = {
  amber: { bg: 'bg-accent-500', text: 'text-accent-600', ring: 'ring-accent-300', gradient: 'from-accent-400 to-accent-600' },
  sky: { bg: 'bg-sea-500', text: 'text-sea-600', ring: 'ring-sea-300', gradient: 'from-sea-400 to-sea-600' },
  emerald: { bg: 'bg-forest-500', text: 'text-forest-600', ring: 'ring-forest-300', gradient: 'from-forest-400 to-forest-600' },
  rose: { bg: 'bg-coral-500', text: 'text-coral-600', ring: 'ring-coral-300', gradient: 'from-coral-400 to-coral-600' },
  slate: { bg: 'bg-ink-500', text: 'text-ink-600', ring: 'ring-ink-300', gradient: 'from-ink-400 to-ink-600' },
};

export const AVATAR_COLORS: Record<string, string> = {
  amber: 'bg-accent-500',
  sky: 'bg-sea-500',
  emerald: 'bg-forest-500',
  rose: 'bg-coral-500',
  slate: 'bg-ink-500',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  writer: 'Writer',
  reader: 'Reader',
  industry: 'Industry Professional',
  admin: 'Administrator',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  writer: 'Upload screenplays and track audience engagement',
  reader: 'Read and evaluate screenplays anonymously',
  industry: 'Discover screenplays backed by audience evidence',
  admin: 'Manage the platform and monitor activity',
};

export const SELECTABLE_ROLE_LABELS: Record<SelectableRole, string> = {
  writer: 'Writer',
  reader: 'Reader',
  industry: 'Industry',
};

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export const THEME_ICONS: Record<ThemePreference, string> = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor',
};

export const INDUSTRY_VERIFICATION_LABELS: Record<IndustryVerificationStatus, string> = {
  unverified: 'Unverified',
  pending: 'Pending Review',
  verified: 'Verified',
  rejected: 'Rejected',
};

export const INDUSTRY_TYPE_LABELS: Record<IndustryType, string> = {
  company_representative: 'Company Representative',
  independent_professional: 'Independent Professional',
};

export function getCoverColor(color: string) {
  return COVER_COLORS[color] ?? COVER_COLORS.amber;
}

export function getAvatarColor(color: string | null) {
  return AVATAR_COLORS[color ?? 'slate'] ?? AVATAR_COLORS.slate;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export function relativeTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
