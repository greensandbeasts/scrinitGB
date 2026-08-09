import type { ReadingSession, Screenplay } from './types';
import type { AnalyticsWeight } from './types';

export interface RetentionPoint {
  page: number;
  readers: number;
  percentage: number;
}

export function computeRetentionCurve(
  sessions: ReadingSession[],
  pageCount: number,
  totalReaders: number,
  weights?: Map<string, number>,
): RetentionPoint[] {
  if (totalReaders === 0 || pageCount === 0) return [];
  const points: RetentionPoint[] = [];
  for (let page = 1; page <= pageCount; page++) {
    const readers = new Set<string>();
    let weightedReaders = 0;
    for (const session of sessions) {
      if (session.last_page_reached >= page) {
        readers.add(session.reader_id);
        const w = weights?.get(session.reader_id) ?? 1.0;
        if (w > 0) weightedReaders += w;
      }
    }
    points.push({
      page,
      readers: readers.size,
      percentage: Math.round((weightedReaders / totalReaders) * 100),
    });
  }
  return points;
}

export interface DropOffPoint {
  page: number;
  dropCount: number;
  dropPercentage: number;
}

export function computeDropOffPoints(retention: RetentionPoint[]): DropOffPoint[] {
  if (retention.length < 2) return [];
  const points: DropOffPoint[] = [];
  for (let i = 1; i < retention.length; i++) {
    const prev = retention[i - 1];
    const curr = retention[i];
    const dropCount = prev.readers - curr.readers;
    if (dropCount > 0) {
      points.push({
        page: curr.page,
        dropCount,
        dropPercentage: Math.round((dropCount / prev.readers) * 100),
      });
    }
  }
  return points.sort((a, b) => b.dropCount - a.dropCount);
}

export function computeEngagementSummary(sessions: ReadingSession[]) {
  const totalSessions = sessions.length;
  const returnSessions = sessions.filter((s) => s.session_number > 1).length;
  const totalDuration = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const abandonedSessions = sessions.filter((s) => s.status === 'abandoned').length;

  return {
    totalSessions,
    returnSessions,
    returnRate: totalSessions > 0 ? Math.round((returnSessions / totalSessions) * 100) : 0,
    totalDuration,
    avgDuration,
    completedSessions,
    abandonedSessions,
  };
}

export function computeWeightedRetentionCurve(
  sessions: ReadingSession[],
  weights: AnalyticsWeight[],
  pageCount: number,
  totalReaders: number,
): RetentionPoint[] {
  const weightMap = new Map<string, number>();
  for (const w of weights) {
    weightMap.set(w.reader_id, w.weight);
  }
  return computeRetentionCurve(sessions, pageCount, totalReaders, weightMap);
}

export function computeConfidenceScore(
  readerCount: number,
  completionRate: number,
  feedbackCount: number,
): { score: number; level: 'low' | 'moderate' | 'strong' | 'high'; label: string } {
  const volumeScore = Math.min(readerCount / 10, 1) * 50;
  const completionScore = (completionRate / 100) * 30;
  const feedbackScore = Math.min(feedbackCount / 10, 1) * 20;
  const score = Math.round(volumeScore + completionScore + feedbackScore);

  let level: 'low' | 'moderate' | 'strong' | 'high';
  let label: string;
  if (score < 25) { level = 'low'; label = 'Low confidence'; }
  else if (score < 50) { level = 'moderate'; label = 'Moderate confidence'; }
  else if (score < 75) { level = 'strong'; label = 'Strong confidence'; }
  else { level = 'high'; label = 'High confidence'; }

  return { score, level, label };
}
