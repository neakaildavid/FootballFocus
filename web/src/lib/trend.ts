// Shared trend-detection contract for the frontend. The real z-score /
// percent-change computation happens in the Python pipeline
// (see /pipeline/trends.py once built) and is persisted per player/stat/week;
// this module just defines the shape and the display threshold so every page
// (Leaders, Usage Trends, Breakout Tracker) renders arrows identically.

export type TrendDirection = "up" | "down" | "none";

export interface TrendResult {
  direction: TrendDirection;
  /** z-score of recent-window rate vs. baseline; magnitude drives arrow display */
  zScore: number;
}

// Configurable, not hardcoded into call sites — tune this one place.
// A z-score threshold of 1.5 corresponds to roughly the top/bottom ~7% of a
// normal distribution, i.e. a meaningfully significant swing rather than
// ordinary game-to-game noise.
export const TREND_Z_THRESHOLD = 1.5;

export function classifyTrend(zScore: number, threshold = TREND_Z_THRESHOLD): TrendResult {
  if (zScore >= threshold) return { direction: "up", zScore };
  if (zScore <= -threshold) return { direction: "down", zScore };
  return { direction: "none", zScore };
}

/**
 * Computes a within-player trend from a single season's game-by-game
 * values, in chronological order: recent-window mean vs. the mean of every
 * game *before* that window, in units of the baseline's own standard
 * deviation. The baseline deliberately excludes the recent window (rather
 * than blending it in) so a hot streak doesn't drag its own comparison
 * point toward itself. Used by Season Leaders (and, once built, Usage
 * Trends / Breakout Tracker) so every trending-arrow surface shares one
 * definition of "trending." Needs at least 2 baseline games with any
 * variance to say anything meaningful — early season, this returns "none".
 */
export function computeTrendFromSeries(
  values: number[],
  recentWindow = 3,
  threshold = TREND_Z_THRESHOLD
): TrendResult {
  if (values.length <= recentWindow) return { direction: "none", zScore: 0 };

  const baseline = values.slice(0, values.length - recentWindow);
  const recent = values.slice(values.length - recentWindow);
  if (baseline.length < 2) return { direction: "none", zScore: 0 };

  const baselineMean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const variance = baseline.reduce((a, b) => a + (b - baselineMean) ** 2, 0) / baseline.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return { direction: "none", zScore: 0 };

  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;

  const zScore = (recentMean - baselineMean) / stddev;
  return classifyTrend(zScore, threshold);
}
