import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPortal } from '@/test/renderPortal';
import DashboardPage from '../DashboardPage';
import ProjectsPage from '../ProjectsPage';
import ProjectWorkspacePage from '../ProjectWorkspacePage';

describe('Overview', () => {
  it('shows a Client Admin what needs their action', async () => {
    renderPortal(<DashboardPage />);
    expect(await screen.findByText('Needs your action')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Your projects')).toBeInTheDocument();
    // Invoices are off by default: no unpaid tile
    expect(screen.queryByText('Unpaid amount')).not.toBeInTheDocument();
  });

  it('shows the unpaid tile only when the operator turned Invoices on', async () => {
    renderPortal(<DashboardPage />, { scenario: { invoicesVisible: true } });
    expect(await screen.findByText('Unpaid amount')).toBeInTheDocument();
  });

  it('tells a Client Viewer that only an admin can approve', async () => {
    renderPortal(<DashboardPage />, { scenario: { userId: 'u-sam' } });
    expect(await screen.findByText('Nothing needs your action. Only a Client Admin can approve items.')).toBeInTheDocument();
  });

  it('shows an empty state when every project was removed', async () => {
    renderPortal(<DashboardPage />, { scenario: { removedProjects: { 'u-sam': ['p1'] }, userId: 'u-sam' } });
    expect(await screen.findByText('No projects are shared with you yet')).toBeInTheDocument();
  });
});

describe('Projects list', () => {
  it('lists only the projects the person is assigned to', async () => {
    renderPortal(<ProjectsPage />, { scenario: { userId: 'u-sam' } });
    expect(await screen.findByText('Brandbase Website Relaunch')).toBeInTheDocument();
    expect(screen.queryByText('Q3 Content Program')).not.toBeInTheDocument();
  });

  it('opens a project in a dialog from its row', async () => {
    renderPortal(<ProjectsPage />, { path: '/projects', route: '/projects' });
    await userEvent.click(await screen.findByText('Brandbase Website Relaunch'));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(await within(dialog).findByText('Latest update')).toBeInTheDocument();
  });

  it('opens the Members tab from the row actions for a Client Admin', async () => {
    renderPortal(<ProjectsPage />, { path: '/projects', route: '/projects' });
    await userEvent.click(await screen.findByRole('button', { name: /Actions for Brandbase Website Relaunch/ }));
    await userEvent.click(await screen.findByText('Assign / remove member'));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('button', { name: /Add/ })).toBeInTheDocument();
  });

  it('shows a Client Viewer the members list without assign controls', async () => {
    renderPortal(<ProjectsPage />, { path: '/projects', route: '/projects?project=p1&tab=members', scenario: { userId: 'u-sam' } });
    expect(await screen.findByText('Only a Client Admin can add or remove people.')).toBeInTheDocument();
  });

  it('filters by search text and pages through the list', async () => {
    renderPortal(<ProjectsPage />, { path: '/projects', route: '/projects' });
    expect(await screen.findByText('Brandbase Website Relaunch')).toBeInTheDocument();
    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /Search by project/ }), 'zzz-no-match');
    expect(await screen.findByText('No projects match your search or filters.')).toBeInTheDocument();
  });
});

describe('Project workspace', () => {
  const open = (tab: string, userId = 'u-alex', search = '', extra = {}) =>
    renderPortal(<ProjectWorkspacePage />, { path: '/projects/:projectId/:tab?', route: `/projects/p1/${tab}${search}`, scenario: { userId, ...extra } });

  it('opens Overview for an unknown tab', async () => {
    open('nonsense');
    expect(await screen.findByText('Latest update')).toBeInTheDocument();
  });

  it('shows the unavailable page for a project the person was removed from', async () => {
    renderPortal(<ProjectWorkspacePage />, {
      path: '/projects/:projectId/:tab?',
      route: '/projects/p7',
      scenario: { userId: 'u-sam' },
    });
    expect(await screen.findByText("This item isn't available")).toBeInTheDocument();
  });

  it('shows a Viewer the locked upload note on Files', async () => {
    open('files', 'u-sam');
    expect(await screen.findByText("Client Viewers can't upload files.")).toBeInTheDocument();
  });

  it('lets a Client Member see the upload button', async () => {
    open('files', 'u-jamie');
    expect(await screen.findByRole('button', { name: /Upload file/ })).toBeInTheDocument();
  });

  it('shows the banner when a linked task was hidden by staff', async () => {
    open('tasks', 'u-alex', '?task=t101', { hiddenIds: ['t101'] });
    expect(await screen.findByText(/The task you opened isn't available/)).toBeInTheDocument();
  });

  it('opens the task drawer from ?task= and locks comments for a Viewer', async () => {
    open('tasks', 'u-sam', '?task=t102');
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText("Client Viewers can't comment.")).toBeInTheDocument();
  });

  it('lets a Member comment on a task', async () => {
    open('tasks', 'u-jamie', '?task=t101');
    const drawer = await screen.findByRole('dialog');
    const box = await within(drawer).findByPlaceholderText('Add a comment…');
    await userEvent.type(box, 'Looks good');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send' }));
    expect(await within(drawer).findByText('Looks good')).toBeInTheDocument();
  });

  it('expands a milestone from ?ms= and shows its linked work', async () => {
    open('milestones', 'u-alex', '?ms=m2');
    expect(await screen.findByText('LINKED WORK')).toBeInTheDocument();
  });
});
