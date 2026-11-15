import { describe, expect, it } from 'vitest';
import { GanttTask } from '../types/gantt-types';
import { buildRoadmapExportRows } from './roadmap-export';

const task = (overrides: Partial<GanttTask>): GanttTask => ({
  id: 'task-1',
  name: 'Design review',
  start_date: new Date(2026, 2, 2),
  end_date: new Date(2026, 2, 10),
  progress: 40,
  type: 'task',
  status: 'Doing',
  priority: 'High',
  assignees: [{ assignee_name: 'Ada Lovelace' }],
  dependencies: ['task-2'],
  ...overrides,
});

describe('buildRoadmapExportRows', () => {
  it('writes each section, then its tasks and subtasks, in the order on screen', () => {
    const rows = buildRoadmapExportRows([
      {
        id: 'phase-1',
        name: 'Discovery',
        start_date: new Date(2026, 2, 1),
        end_date: new Date(2026, 2, 20),
        progress: 0,
        done_progress: 25,
        type: 'milestone',
        is_milestone: true,
        color: '#52c41a',
        children: [task({ id: 'task-1' })],
      },
      task({
        id: 'task-1',
        children: [
          {
            id: 'sub-1',
            name: 'Wireframes',
            start_date: new Date(2026, 2, 3),
            end_date: new Date(2026, 2, 4),
            progress: 100,
            type: 'task',
            status: 'Done',
            priority: 'Medium',
            assignees: [{ assignee_name: 'Grace Hopper' }],
          },
        ],
      }),
      task({ id: 'task-2', name: 'Kickoff', dependencies: [], progress: 100 }),
    ]);

    expect(rows.map(row => [row.kind, row.name])).toEqual([
      ['group', 'Discovery'],
      ['task', 'Design review'],
      ['subtask', 'Wireframes'],
      ['task', 'Kickoff'],
    ]);
    expect(rows[0].progress).toBe(25);
    expect(rows[0].color).toBe('#52c41a');
    expect(rows[0].startDate).toBe('2026-03-01');
    expect(rows[1].assignees).toBe('Ada Lovelace');
    expect(rows[1].dependencies).toBe('Kickoff');
    expect(rows[1].status).toBe('Doing');
    expect(rows[2].parent).toBe('Design review');
    expect(rows[2].assignees).toBe('Grace Hopper');
    expect(rows[2].priority).toBe('Medium');
  });

  it('does not repeat a section’s children as extra tasks', () => {
    const child = task({ id: 'only-once', name: 'Once' });
    const rows = buildRoadmapExportRows([
      {
        id: 'phase-1',
        name: 'Build',
        start_date: null,
        end_date: null,
        progress: 0,
        type: 'milestone',
        is_milestone: true,
        children: [child],
      },
      child,
    ]);

    expect(rows.filter(row => row.name === 'Once')).toHaveLength(1);
  });
});
