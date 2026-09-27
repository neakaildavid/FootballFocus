import { CSSProperties } from "react";

/**
 * Inline animationDelay for a list/table row using the .stagger-item class
 * (see globals.css). Capped so a long list finishes revealing quickly
 * instead of trickling in for seconds — everything past maxSteps animates
 * in alongside the last staggered item.
 */
export function staggerDelay(index: number, stepMs = 30, maxSteps = 12): CSSProperties {
  return { animationDelay: `${Math.min(index, maxSteps) * stepMs}ms` };
}
