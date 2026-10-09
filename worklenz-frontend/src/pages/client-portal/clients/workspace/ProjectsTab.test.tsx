import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  onAssignProject: vi.fn(),
  projects: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      let value = String(options.defaultValue ?? key);
      Object.entries(options).forEach(([param, paramValue]) => {
        value = value.split(`{{${param}}}`).join(String(paramValue));
      });
      return value;
    },
  }),
}));

vi.mock('@/utils/dateUtils', () => ({ formatDate: () => 'Nov 1, 2026' }));

vi.mock('@/api/client-portal/company-users-api', () => ({
  useGetClientProjectsListQuery: () => ({ ...mocks.projects, refetch: mocks.refetch }),
}));

import { ProjectsTab } from './ProjectsTab';

const project = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Website',
  description: null,
  status: 'In Progress',
  status_color: '#70a6f3',
  end_date: '2026-11-01T00:00:00.000Z',
  health_name: 'At Risk',
  health_color: '#f37070',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  total_tasks: 10,
  completed_tasks: 4,
  ...overrides,
});

const setProjects = (projects: Array<Record<string, unknown>>, total = projects.length) => {
  mocks.projects.data = { done: true, body: { projects, total, page: 1, limit: 100 } };
};

const renderTab = () =>
  render(
    <MemoryRouter>
      <ProjectsTab
        clientId="client-1"
        clientName="Beacon Logistics"
        onAssignProject={mocks.onAssignProject}
      />
    </MemoryRouter>
  );

describe('ProjectsTab', () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.onAssignProject.mockReset();
    mocks.projects.data = undefined;
    mocks.projects.isLoading = false;
    mocks.projects.isError = false;
  });

  it('lists each project with its health, progress and due date', () => {
    setProjects([project()]);

    renderTab();

    const row = screen.getAllByRole('row').find(item => within(item).queryByText('Website'))!;
    expect(within(row).getByText('At Risk')).toBeInTheDocument();
    expect(within(row).getByText('40%')).toBeInTheDocument();
    expect(within(row).getByText('Nov 1, 2026')).toBeInTheDocument();
  });

  it('links each project to its task list', () => {
    setProjects([project({ id: 'p9', name: 'Mobile app' })]);

    renderTab();

    expect(screen.getByRole('link', { name: 'Open Mobile app' })).toHaveAttribute(
      'href',
      '/worklenz/projects/p9?tab=tasks-list&pinned_tab=tasks-list'
    );
  });

  it('shows dashes for a project with no health and no end date, and 0% with no tasks', () => {
    setProjects([
      project({
        health_name: null,
        health_color: null,
        end_date: null,
        total_tasks: 0,
        completed_tasks: 0,
      }),
    ]);

    renderTab();

    const row = screen.getAllByRole('row').find(item => within(item).queryByText('Website'))!;
    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(within(row).getByText('0%')).toBeInTheDocument();
  });

  it('does not show a billing column, since projects have no billing type', () => {
    setProjects([project()]);

    renderTab();

    expect(screen.queryByRole('columnheader', { name: /Billing/ })).not.toBeInTheDocument();
  });

  it('assigns another project to the client', () => {
    setProjects([project()]);

    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Assign project/ }));

    expect(mocks.onAssignProject).toHaveBeenCalledTimes(1);
  });

  it('explains an empty client and offers to assign a project', () => {
    setProjects([]);

    renderTab();

    expect(screen.getByText('No projects for Beacon Logistics yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Assign project/ })).toHaveLength(2);
  });

  it('says when only the first projects are shown', () => {
    setProjects([project()], 150);

    renderTab();

    expect(screen.getByText('Showing the first 1 of 150 projects.')).toBeInTheDocument();
  });

  it('offers a retry when the projects cannot be loaded', () => {
    mocks.projects.isError = true;

    renderTab();

    expect(screen.getByText('Could not load this client’s projects.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('shows placeholders while loading', () => {
    mocks.projects.isLoading = true;

    renderTab();

    expect(document.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('No projects for Beacon Logistics yet.')).not.toBeInTheDocument();
  });
});
