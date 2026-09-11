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
