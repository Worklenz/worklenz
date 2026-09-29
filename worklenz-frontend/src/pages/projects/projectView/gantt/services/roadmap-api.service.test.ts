import { describe, it, expect } from 'vitest';
import { sortPhasesForDisplay } from './roadmap-api.service';
import { GanttTask } from '../types/gantt-types';

const milestone = (overrides: Partial<GanttTask>): GanttTask => ({
  id: 'phase-id',
  name: 'name',
  start_date: null,
  end_date: null,
  progress: 0,
  type: 'milestone',
  is_milestone: true,
  ...overrides,
});

describe('sortPhasesForDisplay', () => {
  it('returns the input order unchanged in manual mode', () => {
    const milestones = [
      milestone({ id: 'c', start_date: new Date('2026-01-01') }),
      milestone({ id: 'a', start_date: new Date('2026-03-01') }),
      milestone({ id: 'b', start_date: null }),
    ];

    expect(sortPhasesForDisplay(milestones, 'manual')).toEqual(milestones);
  });

  it('sorts dated phases earliest-first in chronological mode', () => {
    const late = milestone({ id: 'late', start_date: new Date('2026-06-01') });
    const early = milestone({ id: 'early', start_date: new Date('2026-01-01') });
    const mid = milestone({ id: 'mid', start_date: new Date('2026-03-01') });

    const result = sortPhasesForDisplay([late, early, mid], 'chronological');

    expect(result.map(m => m.id)).toEqual(['early', 'mid', 'late']);
  });

  it('sorts a phase using its fallback (child-task-derived) date alongside phases with their own explicit date', () => {
    // Mirrors transformToGanttTasks: a phase with no date of its own gets a
    // fallback start_date computed from its child tasks before sortPhasesForDisplay
    // ever runs, so by the time it gets here it looks just like an explicit date.
    const ownDateLate = milestone({ id: 'own-date-late', start_date: new Date('2026-10-31') });
    const fallbackDateEarly = milestone({ id: 'fallback-date-early', start_date: new Date('2026-09-01') });
    const ownDateMid = milestone({ id: 'own-date-mid', start_date: new Date('2026-09-30') });

    const result = sortPhasesForDisplay(
      [ownDateLate, fallbackDateEarly, ownDateMid],
      'chronological'
    );

    expect(result.map(m => m.id)).toEqual(['fallback-date-early', 'own-date-mid', 'own-date-late']);
  });

  it('pins undated phases at the bottom, preserving their relative order', () => {
    const dated = milestone({ id: 'dated', start_date: new Date('2026-02-01') });
    const undatedFirst = milestone({ id: 'undated-first', start_date: null });
    const undatedSecond = milestone({ id: 'undated-second', start_date: null });

    const result = sortPhasesForDisplay([undatedFirst, dated, undatedSecond], 'chronological');

    expect(result.map(m => m.id)).toEqual(['dated', 'undated-first', 'undated-second']);
  });

  it('keeps the synthetic Unmapped milestone pinned last', () => {
    const dated = milestone({ id: 'dated', start_date: new Date('2026-02-01') });
    const undated = milestone({ id: 'undated', start_date: null });
    const unmapped = milestone({ id: 'phase-unmapped', name: 'Unmapped', start_date: null });

    // transformToGanttTasks always appends the Unmapped milestone last, pre-sort.
    const result = sortPhasesForDisplay([dated, undated, unmapped], 'chronological');

    expect(result.map(m => m.id)).toEqual(['dated', 'undated', 'phase-unmapped']);
  });

  it('does not mutate the input array', () => {
    const milestones = [
      milestone({ id: 'b', start_date: new Date('2026-02-01') }),
      milestone({ id: 'a', start_date: new Date('2026-01-01') }),
    ];
    const original = [...milestones];

    sortPhasesForDisplay(milestones, 'chronological');

    expect(milestones).toEqual(original);
  });
});
