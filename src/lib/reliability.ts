import type { ReadingSession, ContributionAlgorithmVersion, AnalyticsWeightLevel, ReliabilityFlagType } from './types';

export interface ReliabilitySignals {
  activeReadingSeconds: number;
  totalDurationSeconds: number;
  pagesRead: number;
  pageCount: number;
  sessionCount: number;
  avgPagesPerMinute: number;
  maxPageSkip: number;
  hasReturnSessions: boolean;
  feedbackQualityScore: number | null;
  inactiveSessionRatio: number;
}

export interface ReliabilityResult {
  weight: number;
  level: AnalyticsWeightLevel;
  signals: Record<string, number | boolean>;
  flags: { type: ReliabilityFlagType; severity: 'low' | 'medium' | 'high'; detail: Record<string, number | string> }[];
}

export function computeReliabilitySignals(
  sessions: ReadingSession[],
  pageCount: number,
  feedbackQualityScore: number | null,
): ReliabilitySignals {
  const totalDurationSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const activeReadingSeconds = sessions.reduce((sum, s) => sum + s.active_reading_seconds, 0);
  const lastSession = sessions.sort((a, b) => (b.session_number - a.session_number))[0];
  const pagesRead = lastSession?.last_page_reached ?? 0;
  const sessionCount = sessions.length;
  const hasReturnSessions = sessionCount > 1;

  const avgPagesPerMinute = activeReadingSeconds > 0
    ? (pagesRead / (activeReadingSeconds / 60))
    : 0;

  const inactiveSessions = sessions.filter(s => s.active_reading_seconds < 30).length;
  const inactiveSessionRatio = sessionCount > 0 ? inactiveSessions / sessionCount : 0;

  const maxPageSkip = sessions.reduce((max, s) => {
    const skip = s.pages_read_this_session > 0 ? Math.max(0, s.last_page_reached - s.pages_read_this_session) : 0;
    return Math.max(max, skip);
  }, 0);

  return {
    activeReadingSeconds,
    totalDurationSeconds,
    pagesRead,
    pageCount,
    sessionCount,
    avgPagesPerMinute,
    maxPageSkip,
    hasReturnSessions,
    feedbackQualityScore,
    inactiveSessionRatio,
  };
}

export function evaluateReliability(
  signals: ReliabilitySignals,
  config: ContributionAlgorithmVersion,
): ReliabilityResult {
  const flags: ReliabilityResult['flags'] = [];
  const signalsRecord: Record<string, number | boolean> = {};

  const integrity = config.integrity_checks;

  if (signals.avgPagesPerMinute > 10 && signals.activeReadingSeconds > 60) {
    flags.push({
      type: 'rapid_scrolling',
      severity: 'medium',
      detail: { pages_per_min: Math.round(signals.avgPagesPerMinute * 100) / 100 },
    });
  }
  signalsRecord.avg_pages_per_minute = Math.round(signals.avgPagesPerMinute * 100) / 100;

  if (signals.maxPageSkip > (integrity.max_page_skip ?? 5)) {
    flags.push({
      type: 'impossible_progression',
      severity: 'high',
      detail: { max_skip: signals.maxPageSkip, threshold: integrity.max_page_skip ?? 5 },
    });
  }
  signalsRecord.max_page_skip = signals.maxPageSkip;

  if (signals.activeReadingSeconds < (integrity.min_active_reading_seconds ?? 30) && signals.pagesRead > 3) {
    flags.push({
      type: 'session_padding',
      severity: 'medium',
      detail: { active_seconds: signals.activeReadingSeconds, pages_read: signals.pagesRead },
    });
  }
  signalsRecord.active_reading_seconds = signals.activeReadingSeconds;

  if (signals.inactiveSessionRatio > (integrity.max_inactive_sessions_pct ?? 50) / 100) {
    flags.push({
      type: 'excessive_inactivity',
      severity: 'low',
      detail: { inactive_ratio: Math.round(signals.inactiveSessionRatio * 100) / 100 },
    });
  }
  signalsRecord.inactive_session_ratio = Math.round(signals.inactiveSessionRatio * 100) / 100;

  if (signals.feedbackQualityScore !== null && signals.feedbackQualityScore < (integrity.min_feedback_quality ?? 0.3)) {
    flags.push({
      type: 'ai_generated_feedback',
      severity: 'medium',
      detail: { quality_score: signals.feedbackQualityScore },
    });
  }
  if (signals.feedbackQualityScore !== null) {
    signalsRecord.feedback_quality_score = signals.feedbackQualityScore;
  }

  recordSignals(signals, signalsRecord);

  const highFlags = flags.filter(f => f.severity === 'high').length;
  const mediumFlags = flags.filter(f => f.severity === 'medium').length;
  const totalFlags = flags.length;
  const autoExcludeThreshold = config.exclusion_thresholds.auto_exclude_flags ?? 3;

  let level: AnalyticsWeightLevel;
  let weight: number;

  if (highFlags >= 2 || totalFlags >= autoExcludeThreshold) {
    level = 'excluded';
    weight = config.weight_excluded;
  } else if (highFlags >= 1 || mediumFlags >= 2) {
    level = 'low';
    weight = config.weight_low;
  } else if (totalFlags > 0) {
    level = 'reduced';
    weight = config.weight_reduced;
  } else {
    level = 'full';
    weight = config.weight_full;
  }

  return { weight, level, signals: signalsRecord, flags };
}

function recordSignals(signals: ReliabilitySignals, record: Record<string, number | boolean>) {
  record.pages_read = signals.pagesRead;
  record.page_count = signals.pageCount;
  record.session_count = signals.sessionCount;
  record.has_return_sessions = signals.hasReturnSessions;
  record.total_duration_seconds = signals.totalDurationSeconds;
}

export function applyAnalyticsWeighting<T extends { reader_id: string; last_page_reached: number; status: string; duration_seconds: number }>(
  sessions: T[],
  weights: Map<string, number>,
): T[] {
  return sessions.filter(s => {
    const weight = weights.get(s.reader_id) ?? 1.0;
    return weight > 0;
  });
}

export interface WeightedEngagementSummary {
  totalSessions: number;
  returnSessions: number;
  returnRate: number;
  totalDuration: number;
  avgDuration: number;
  completedSessions: number;
  abandonedSessions: number;
  weightedCompletionRate: number;
  weightedRecommendRate: number;
}

export function computeWeightedEngagement(
  sessions: ReadingSession[],
  weights: Map<string, number>,
  feedbackCount: number,
  recommendCount: number,
): WeightedEngagementSummary {
  const totalSessions = sessions.length;
  const returnSessions = sessions.filter(s => s.session_number > 1).length;
  const totalDuration = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const abandonedSessions = sessions.filter(s => s.status === 'abandoned').length;

  const weightedCompletion = sessions.reduce((sum, s) => {
    const w = weights.get(s.reader_id) ?? 1.0;
    return sum + (s.status === 'completed' ? w : 0);
  }, 0);
  const totalWeight = sessions.reduce((sum, s) => sum + (weights.get(s.reader_id) ?? 1.0), 0);
  const weightedCompletionRate = totalWeight > 0 ? Math.round((weightedCompletion / totalWeight) * 100) : 0;

  const weightedRecommend = recommendCount;
  const weightedRecommendRate = feedbackCount > 0 ? Math.round((weightedRecommend / feedbackCount) * 100) : 0;

  return {
    totalSessions,
    returnSessions,
    returnRate: totalSessions > 0 ? Math.round((returnSessions / totalSessions) * 100) : 0,
    totalDuration,
    avgDuration,
    completedSessions,
    abandonedSessions,
    weightedCompletionRate,
    weightedRecommendRate,
  };
}
