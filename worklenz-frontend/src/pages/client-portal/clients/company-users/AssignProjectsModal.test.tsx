import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyUser } from '@/api/client-portal/company-users-api';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  saveProjects: vi.fn(),
  onClose: vi.fn(),
  projectsQuery: {
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
        value = value.replace(`{{${param}}}`, String(paramValue));
      });
      return value;
    },
  }),
}));

vi.mock('@/api/client-portal/company-users-api', () => ({
  useGetClientProjectsListQuery: () => ({ ...mocks.projectsQuery, refetch: mocks.refetch }),
  useSetCompanyUserProjectsMutation: () => [mocks.saveProjects, { isLoading: false }],
}));

import { AssignProjectsModal } from './AssignProjectsModal';

const buildProject = (id: string, name: string) => ({
  id,
  name,
  description: null,
  status: null,
  status_color: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  total_tasks: 0,
  completed_tasks: 0,
});

const PROJECTS = [
  buildProject('p1', 'Website'),
  buildProject('p2', 'Brand refresh'),
  buildProject('p3', 'Mobile app'),
];

const setProjects = (projects = PROJECTS, total = projects.length) => {
  mocks.projectsQuery.data = { done: true, body: { projects, total, page: 1, limit: 100 } };
};

const buildUser = (overrides: Partial<CompanyUser> = {}): CompanyUser => ({
  id: 'u1',
  client_id: 'c1',
  company_name: 'Brandbase',
  name: 'Alex Chen',
  email: 'alex@brandbase.com',
  phone: null,
  job_title: null,
  role: 'member',
  has_login: false,
  last_login_at: null,
  invited_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  portal_status: { status: 'not_invited', label: 'Not Invited', color: 'default' },
  project_count: 0,
  projects: [],
  ...overrides,
});

const renderModal = (user: CompanyUser = buildUser()) =>
  render(<AssignProjectsModal user={user} open onClose={mocks.onClose} />);

const projectCard = (name: string) =>
  screen.getByRole('checkbox', { name }).closest('div[style*="border"]') as HTMLElement;

describe('AssignProjectsModal', () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.onClose.mockReset();
    mocks.saveProjects.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({ body: {} }) });
    mocks.projectsQuery.data = undefined;
    mocks.projectsQuery.isLoading = false;
    mocks.projectsQuery.isError = false;
  });

  it('explains a company with no projects and disables everything that needs one', () => {
    setProjects([]);

    renderModal();

    expect(screen.getByText('Brandbase has no projects yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Standard Contact' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Full Partner' })).toBeDisabled();
    expect(screen.queryByRole('checkbox', { name: 'Select all' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save access' })).toBeDisabled();
  });

  it('applies a template to every current project in one click', () => {
    setProjects();

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Standard Contact' }));

    PROJECTS.forEach(project => {
      expect(screen.getByRole('checkbox', { name: project.name })).toBeChecked();
      expect(
        within(projectCard(project.name)).getByRole('radio', { name: 'View + comment' })
      ).toBeChecked();
    });
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();
  });

  it('a template replaces the levels chosen before it', () => {
    setProjects();

    renderModal(
      buildUser({
        projects: [{ project_id: 'p1', name: 'Website', level: 'contributor' }],
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'View Only' }));

    expect(within(projectCard('Website')).getByRole('radio', { name: 'View only' })).toBeChecked();
  });

  it('sets a level per project, independently', async () => {
    setProjects();

    renderModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Website' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mobile app' }));
    fireEvent.click(
      within(projectCard('Mobile app')).getByRole('radio', { name: 'Full contributor' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save access' }));

    await waitFor(() =>
      expect(mocks.saveProjects).toHaveBeenCalledWith({
        id: 'u1',
        projects: [
          { project_id: 'p1', level: 'view' },
          { project_id: 'p3', level: 'contributor' },
        ],
      })
    );
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it('selects all, then applies one level to the whole selection', async () => {
    setProjects();

    renderModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByText('Set access for 3 selected:')).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByText('Set access for 3 selected:').parentElement as HTMLElement).getByRole(
        'button',
        { name: 'Full contributor' }
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save access' }));

    await waitFor(() =>
      expect(mocks.saveProjects).toHaveBeenCalledWith({
        id: 'u1',
        projects: [
          { project_id: 'p1', level: 'contributor' },
          { project_id: 'p2', level: 'contributor' },
          { project_id: 'p3', level: 'contributor' },
        ],
      })
    );
  });

  it('clears the selection when Select all is used on a full selection', () => {
    setProjects();

    renderModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));

    PROJECTS.forEach(project =>
      expect(screen.getByRole('checkbox', { name: project.name })).not.toBeChecked()
    );
  });

  it('starts from the access the user already has', () => {
    setProjects();

    renderModal(
      buildUser({
        project_count: 1,
        projects: [{ project_id: 'p2', name: 'Brand refresh', level: 'comment' }],
      })
    );

    expect(screen.getByRole('checkbox', { name: 'Brand refresh' })).toBeChecked();
    expect(
      within(projectCard('Brand refresh')).getByRole('radio', { name: 'View + comment' })
    ).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Website' })).not.toBeChecked();
  });

  it('can remove all access', async () => {
    setProjects();

    renderModal(
      buildUser({
        project_count: 1,
        projects: [{ project_id: 'p2', name: 'Brand refresh', level: 'comment' }],
      })
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Brand refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save access' }));

    await waitFor(() =>
      expect(mocks.saveProjects).toHaveBeenCalledWith({ id: 'u1', projects: [] })
    );
  });

  it('will not save when some of the company’s projects could not be listed', () => {
    setProjects(PROJECTS, 150);

    renderModal();

    expect(screen.getByText(/Only 3 of 150 projects are shown/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save access' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'View Only' })).toBeDisabled();
  });

  it('offers a retry when the projects cannot be loaded', () => {
    mocks.projectsQuery.isError = true;

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save access' })).toBeDisabled();
  });

  it('keeps the modal open and shows the error when saving fails', async () => {
    setProjects();
    mocks.saveProjects.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: 'One or more projects do not belong to this company' } }),
    });

    renderModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Website' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save access' }));

    expect(
      await screen.findByText('One or more projects do not belong to this company')
    ).toBeInTheDocument();
    expect(mocks.onClose).not.toHaveBeenCalled();
  });
});
