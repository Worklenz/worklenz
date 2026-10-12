export const DEFAULT_STORY_POINT_SCALE: readonly number[] = [0, 1, 2, 3, 5, 8, 13, 21];

const MAX_POINT_VALUE = 1000;
const MAX_SCALE_LENGTH = 30;

/** Project scale (or the default), plus the current value when it is no longer on the scale. */
export const getStoryPointOptions = (
  scale: readonly number[] | null | undefined,
  currentValue?: number | null
): number[] => {
  const values = new Set(scale?.length ? scale : DEFAULT_STORY_POINT_SCALE);
  if (typeof currentValue === 'number' && Number.isFinite(currentValue)) {
    values.add(currentValue);
  }
  return [...values].sort((a, b) => a - b);
};

/**
 * Parses comma-separated story point values into a sorted, de-duplicated scale.
 * Returns null when the input is empty or contains an invalid value.
 */
export const parseStoryPointScale = (input: string): number[] | null => {
  const tokens = input
    .split(',')
    .map(token => token.trim())
    .filter(Boolean);
  if (!tokens.length) return null;

  const numbers = tokens.map(Number);
  const hasInvalidValue = numbers.some(
    value => !Number.isFinite(value) || value < 0 || value > MAX_POINT_VALUE
  );
  if (hasInvalidValue) return null;

  const scale = [...new Set(numbers)].sort((a, b) => a - b);
  return scale.length <= MAX_SCALE_LENGTH ? scale : null;
};

/** Sums story points, treating unestimated issues as 0. */
export const sumStoryPoints = (points: Array<number | null | undefined>): number =>
  points.reduce<number>((total, value) => total + (typeof value === 'number' ? value : 0), 0);

/** Formats points without trailing decimals (e.g. 3, 0.5). */
export const formatStoryPoints = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
