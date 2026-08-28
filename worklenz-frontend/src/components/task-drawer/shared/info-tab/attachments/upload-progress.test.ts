import { describe, expect, it } from 'vitest';
import { formatUploadSpeed } from './upload-progress';

describe('formatUploadSpeed', () => {
  it('formats bytes per second into a human-readable rate', () => {
    expect(formatUploadSpeed(1536)).toBe('1.5 KB/s');
    expect(formatUploadSpeed(0)).toBe('0 B/s');
  });

  it('returns undefined for missing values', () => {
    expect(formatUploadSpeed(undefined)).toBeUndefined();
  });
});
