import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/types/task-management.types';

const mocks = vi.hoisted(() => ({
  state: {
    phaseReducer: {
      phaseList: [
        {
          id: 'phase-light',
          name: 'Design',
          color_code: '#70A6F3',
        },
        {
          id: 'phase-dark',
          name: 'Launch',
          color_code: '#154C9B',
        },
      ],
    },
    projectReducer: {
      project: {
        project_type: 'default',
      },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));

vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));

vi.mock('@/lib/project/software-project', () => ({
  isSoftwareProjectType: () => false,
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      teamMembersReducer: {
        teamMembers: {
          data: [],
          total: 0,
        },
      },
    }),
}));

vi.mock('@/components', () => ({
  Avatar: () => null,
  Checkbox: () => null,
}));

import TaskPhaseDropdown from './task-phase-dropdown';

describe('TaskPhaseDropdown', () => {
  it.each([
    ['phase-light', 'Design', '#70A6F3', '#000000'],
    ['phase-dark', 'Launch', '#154C9B', '#FFFFFF'],
  ])(
    'uses the higher-contrast label color for phase %s',
    (phaseId, phaseName, backgroundColor, color) => {
      const task = { id: 'task-1', phase: phaseId } as Task;
      render(<TaskPhaseDropdown task={task} projectId="project-1" />);

      expect(screen.getByRole('button', { name: phaseName })).toHaveStyle({
        backgroundColor,
        color,
      });
    }
  );

  it('uses adaptive contrast for the empty phase pill', () => {
    const task = { id: 'task-2' } as Task;
    const { rerender } = render(
      <TaskPhaseDropdown task={task} projectId="project-1" isDarkMode={false} />
    );

    expect(screen.getByRole('button', { name: 'Select' })).toHaveStyle({
      backgroundColor: '#9CA3AF',
      color: '#000000',
    });

    rerender(<TaskPhaseDropdown task={task} projectId="project-1" isDarkMode />);

    expect(screen.getByRole('button', { name: 'Select' })).toHaveStyle({
      backgroundColor: '#4B5563',
      color: '#FFFFFF',
    });
  });
});
