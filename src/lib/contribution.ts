import type { ContributionAlgorithmVersion, ReadingSession, ReaderFeedback } from './types';

export interface ContributionBreakdown {
  pages: number;
  time: number;
  feedback: number;
  completion: number;
  total: number;
  breakdown: Record<string, number>;
}

export function computePageContribution(
  pagesRead: number,
  config: ContributionAlgorithmVersion,
): number {
  if (!config.page_points_enabled) return 0;
  return Math.round(pagesRead * config.points_per_page);
}

export function computeTimeContribution(
  activeReadingSeconds: number,
  config: ContributionAlgorithmVersion,
): number {
  if (!config.time_points_enabled) return 0;
  const minutes = activeReadingSeconds / 60;
  const rawPoints = Math.floor(minutes / config.minutes_per_point);
  return Math.min(rawPoints, config.max_time_contribution);
}

export function computeFeedbackBonus(
  stopPage: number,
  config: ContributionAlgorithmVersion,
): number {
  if (!config.feedback_bonus_enabled) return 0;
  if (stopPage <= 3) return config.feedback_starting_bonus;
  const pagesBeyondThree = stopPage - 3;
  const reductionSteps = Math.floor(pagesBeyondThree / config.feedback_reduction_rate);
  const bonus = config.feedback_starting_bonus - (reductionSteps * config.feedback_reduction_amount);
  return Math.max(bonus, config.feedback_min_bonus);
}

export function computeCompletionBonus(
  isComplete: boolean,
  config: ContributionAlgorithmVersion,
): number {
  if (!config.completion_bonus_enabled || !isComplete) return 0;
  return config.completion_bonus_points;
}

export function computeTotalContribution(
  session: ReadingSession,
  feedback: { written_feedback: string; completion_status: string } | null,
  config: ContributionAlgorithmVersion,
): ContributionBreakdown {
  const pagesRead = session.last_page_reached;
  const activeSeconds = session.active_reading_seconds;

  const pagePoints = computePageContribution(pagesRead, config);
  const timePoints = computeTimeContribution(activeSeconds, config);
  const completionPoints = computeCompletionBonus(
    feedback?.completion_status === 'completed',
    config,
  );

  let feedbackPoints = 0;
  if (feedback && feedback.written_feedback.length >= config.feedback_min_chars) {
    feedbackPoints = computeFeedbackBonus(pagesRead, config);
  }

  const rawTotal = pagePoints + timePoints + feedbackPoints + completionPoints;
  const total = Math.min(rawTotal, config.max_contribution_per_screenplay);

  return {
    pages: pagePoints,
    time: timePoints,
    feedback: feedbackPoints,
    completion: completionPoints,
    total,
    breakdown: {
      pages: pagePoints,
      time: timePoints,
      feedback: feedbackPoints,
      completion: completionPoints,
    },
  };
}

export function analyzeFeedbackQuality(
  feedbackText: string,
): { score: number; scores: Record<string, number>; analysis: string } {
  const text = feedbackText.trim();
  if (text.length < 20) {
    return { score: 0.1, scores: { overall: 0.1 }, analysis: 'Too short to assess.' };
  }

  const checks: Record<string, number> = {};

  checks.length = Math.min(text.length / 300, 1);

  const characterWords = ['character', 'protagonist', 'antagonist', 'arc', 'protag', 'villain', 'hero', 'lead'];
  checks.mentions_characters = characterWords.some(w => text.toLowerCase().includes(w)) ? 1 : 0;

  const dialogueWords = ['dialogue', 'speech', 'lines', 'said', 'spoke', 'voice', 'conversation'];
  checks.mentions_dialogue = dialogueWords.some(w => text.toLowerCase().includes(w)) ? 1 : 0;

  const pacingWords = ['pacing', 'slow', 'fast', 'rushed', 'drag', 'tempo', 'speed', 'momentum'];
  checks.mentions_pacing = pacingWords.some(w => text.toLowerCase().includes(w)) ? 1 : 0;

  const structureWords = ['structure', 'plot', 'scene', 'act', 'beginning', 'ending', 'setup', 'payoff', 'conflict', 'climax'];
  checks.mentions_structure = structureWords.some(w => text.toLowerCase().includes(w)) ? 1 : 0;

  const themeWords = ['theme', 'message', 'meaning', 'about', 'explores', 'examines', 'says'];
  checks.mentions_theme = themeWords.some(w => text.toLowerCase().includes(w)) ? 1 : 0;

  const specifics = text.match(/"[^"]+"|'[^']+'|\bpage\b|\bscene\b/g);
  checks.has_specific_references = specifics && specifics.length >= 1 ? 1 : 0;

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const avgSentenceLength = sentences.length > 0 ? text.length / sentences.length : text.length;
  checks.reasoning_depth = Math.min(avgSentenceLength / 80, 1);

  const genericPhrases = ["didn't like it", "it was good", "it was bad", "not good", "was ok", "was okay", "i liked it", "i didn't like it", "boring", "interesting"];
  checks.not_generic = genericPhrases.some(p => text.toLowerCase().trim() === p) ? 0 : 1;

  const weights: Record<string, number> = {
    length: 0.15, mentions_characters: 0.15, mentions_dialogue: 0.1,
    mentions_pacing: 0.1, mentions_structure: 0.15, mentions_theme: 0.1,
    has_specific_references: 0.1, reasoning_depth: 0.1, not_generic: 0.05,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += (checks[key] ?? 0) * weight;
  }

  score = Math.min(Math.round(score * 100) / 100, 1.0);

  const analysis = score >= 0.7 ? 'High quality feedback with specific observations.'
    : score >= 0.4 ? 'Moderate quality — some specific observations present.'
    : 'Low quality — feedback appears generic or lacks detail.';

  return { score, scores: checks, analysis };
}

export function meetsFeedbackRequirements(
  feedbackText: string,
  config: ContributionAlgorithmVersion,
  qualityScore: number | null,
): { valid: boolean; reason: string | null } {
  const text = feedbackText.trim();
  if (text.length < config.feedback_min_chars) {
    return { valid: false, reason: `Feedback must be at least ${config.feedback_min_chars} characters (currently ${text.length}).` };
  }
  if (text.length > config.feedback_max_chars) {
    return { valid: false, reason: `Feedback must be at most ${config.feedback_max_chars} characters (currently ${text.length}).` };
  }
  if (config.ai_quality_enabled && qualityScore !== null && qualityScore < config.ai_quality_threshold) {
    return { valid: false, reason: `Feedback quality score (${qualityScore.toFixed(2)}) is below the required threshold (${config.ai_quality_threshold}).` };
  }
  return { valid: true, reason: null };
}

export const STOP_REASONS: { value: string; label: string }[] = [
  { value: 'didnt_hook_me', label: "Didn't hook me" },
  { value: 'lost_interest', label: 'Lost interest' },
  { value: 'confusing', label: 'Confusing' },
  { value: 'pacing', label: 'Pacing' },
  { value: 'dialogue', label: 'Dialogue' },
  { value: 'characters', label: 'Characters' },
  { value: 'formatting', label: 'Formatting' },
  { value: 'not_my_genre', label: 'Not my genre' },
  { value: 'other', label: 'Other' },
];
