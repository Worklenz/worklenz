// PPM Phase 1: 15-minute time tracking increment enforcement

const parsed = parseInt(process.env.PPM_TIME_INCREMENT || "900", 10);
export const PPM_TIME_INCREMENT = Number.isFinite(parsed) && parsed > 0 ? parsed : 900;

/**
 * Rounds seconds to the nearest 15-minute (900s) increment.
 * Minimum is one increment (15 min) if any time was logged.
 */
export function roundToNearest15Min(seconds: number): number {
  if (!seconds || seconds <= 0) return PPM_TIME_INCREMENT;
  const rounded = Math.round(seconds / PPM_TIME_INCREMENT) * PPM_TIME_INCREMENT;
  return Math.max(rounded, PPM_TIME_INCREMENT);
}
