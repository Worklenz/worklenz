import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyProjectsToTasks } = vi.hoisted(() => ({
  getMyProjectsToTasks: vi.fn(),
}));

vi.mock('@/api/projects/projects.api.service', () => ({
  projectsApiService: {
    getMyProjectsToTasks,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, string | undefined>) => {
      let value = options?.defaultValue || _key;
      if (options) {
        Object.entries(options).forEach(([param, paramValue]) => {
          if (param !== 'defaultValue' && paramValue != null) {
            value = value.replace(`{{${param}}}`, paramValue);
          }
        });
      }
      return value;
    },
  }),
}));

import CopyTaskToProjectModal from './CopyTaskToProjectModal';

describe('CopyTaskToProjectModal', () => {
  beforeEach(() => {
    getMyProjectsToTasks.mockReset();
  });

  it('loads accessible projects and excludes the source project', async () => {
    getMyProjectsToTasks.mockResolvedValue({
      done: true,
      body: [
        { id: 'source-project', name: 'Current project' },
        { id: 'destination-project', name: 'Destination project' },
      ],
    });

    render(
      <CopyTaskToProjectModal
        open
        sourceProjectId="source-project"
        onCompare={vi.fn().mockResolvedValue({
          hasDifferences: false,
          missingDefaultColumns: [],
          missingCustomColumns: [],
          missingPhases: [],
          statusMapping: { isMissing: false },
        })}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await waitFor(() => expect(getMyProjectsToTasks).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByText('Select a destination project'));
    await waitFor(() => expect(screen.getByText('Destination project')).toBeInTheDocument());
    expect(screen.queryByText('Current project')).not.toBeInTheDocument();
  });

  it('checks differences on project select and enables copy', async () => {
    getMyProjectsToTasks.mockResolvedValue({
      done: true,
      body: [{ id: 'destination-project', name: 'Destination project' }],
    });
    const onCompare = vi.fn().mockResolvedValue({
      hasDifferences: false,
      missingDefaultColumns: [],
      missingCustomColumns: [],
      missingPhases: [],
      statusMapping: { isMissing: false },
    });
    const onConfirm = vi.fn();

    render(
      <CopyTaskToProjectModal
        open
        sourceProjectId="source-project"
        onCompare={onCompare}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    await waitFor(() => expect(getMyProjectsToTasks).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByText('Select a destination project'));
    fireEvent.click(await screen.findByText('Destination project'));

    await waitFor(() => expect(onCompare).toHaveBeenCalledWith('destination-project'));

    const copyButton = await screen.findByRole('button', { name: 'Copy task' });
    fireEvent.click(copyButton);
    expect(onConfirm).toHaveBeenCalledWith('destination-project', false, true);
  });

  it('shows status fallback message when destination is missing the task status', async () => {
    getMyProjectsToTasks.mockResolvedValue({
      done: true,
      body: [{ id: 'destination-project', name: 'Destination project' }],
    });
    const onCompare = vi.fn().mockResolvedValue({
      hasDifferences: true,
      missingDefaultColumns: [],
      missingCustomColumns: [],
      missingPhases: [],
      statusMapping: {
        isMissing: true,
        sourceStatusName: 'new todo',
        sourceCategoryName: 'To do',
        destinationStatusName: 'To Do',
        destinationCategoryName: 'To do',
      },
    });

    render(
      <CopyTaskToProjectModal
        open
        sourceProjectId="source-project"
        onCompare={onCompare}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await waitFor(() => expect(getMyProjectsToTasks).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByText('Select a destination project'));
    fireEvent.click(await screen.findByText('Destination project'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Status "new todo" is not in the destination project. The task will be assigned to the main "To Do" status.'
        )
      ).toBeInTheDocument()
    );
  });
});
