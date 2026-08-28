import { describe, expect, it } from 'vitest';
import { resolveTaskProgress } from './task-progress';

describe('resolveTaskProgress', () => {
  it('preserves the backend ratio instead of recalculating from completed subtasks', () => {
    const task = {
      progress_value: 66.67,
      complete_ratio: 66.67,
      sub_tasks: [
        { progress_value: 100 },
        { progress_value: 100 },
      ],
    };

    expect(resolveTaskProgress(task)).toBeCloseTo(66.67, 2);
  });

  it('falls back to progress_value when complete_ratio is missing', () => {
    const task = {
      progress_value: 75,
      sub_tasks: [{ progress_value: 100 }, { progress_value: 50 }],
    };

    expect(resolveTaskProgress(task)).toBe(75);
  });

  it('uses the persisted progress value when the ratio fields disagree', () => {
    expect(resolveTaskProgress({ progress_value: 75, complete_ratio: 100, progress: 100 })).toBe(75);
  });
});
