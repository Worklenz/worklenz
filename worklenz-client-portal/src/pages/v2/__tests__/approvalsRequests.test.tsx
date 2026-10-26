import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPortal } from '@/test/renderPortal';
import ApprovalsPage from '../ApprovalsPage';
import ChangeRequestsPage from '../ChangeRequestsPage';

const approval = (id: string, scenario = {}) =>
  renderPortal(<ApprovalsPage />, { path: '/approvals/:id', route: `/approvals/${id}`, scenario });
const changeRequest = (id: string, scenario = {}) =>
  renderPortal(<ChangeRequestsPage />, { path: '/change-requests/:id', route: `/change-requests/${id}`, scenario });

describe('Approvals list', () => {
  it('splits awaiting from completed and shows Review to the person who can decide', async () => {
    renderPortal(<ApprovalsPage />, { path: '/approvals', route: '/approvals' });
    expect(await screen.findByText('Approve homepage wireframe v3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Actions for Approve homepage wireframe v3/ }));
    expect(await screen.findByText('Review')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('radio', { name: /Completed/ }));
    expect(await screen.findByText('Approve Brand Guidelines v2')).toBeInTheDocument();
  });

  it('explains the role limit to a Client Member', async () => {
    renderPortal(<ApprovalsPage />, { path: '/approvals', route: '/approvals', scenario: { userId: 'u-jamie' } });
    expect(await screen.findByText(/As a Client Member you can see approvals but not decide them/)).toBeInTheDocument();
  });
});

describe('Approval detail', () => {
  it('records one decision when Approve is clicked twice quickly', async () => {
    approval('ap123');
    const button = await screen.findByRole('button', { name: /Approve$/ });
    await userEvent.dblClick(button);
    expect(await screen.findByText(/Approved by Alex Chen/)).toBeInTheDocument();
    // The history gains exactly one "Approved" entry
    expect(screen.getAllByText(/Approved \(Homepage Wireframe\.fig v3\)/)).toHaveLength(1);
  });

  it('asks once before recording "Request changes" without a comment', async () => {
    approval('ap123');
    await userEvent.click(await screen.findByRole('button', { name: 'Request changes' }));
    expect(await screen.findByText(/Tell your team what to change/)).toBeInTheDocument();
    expect(screen.queryByText(/Changes requested by/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Request changes without a comment' }));
    expect(await screen.findByText(/Changes requested by Alex Chen/)).toBeInTheDocument();
  });

  it('disables the decision for a Client Member and says why', async () => {
    approval('ap123', { userId: 'u-jamie' });
    expect(await screen.findByText(/As a Client Member you can view this approval but not decide it/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Request changes' })).toBeDisabled();
  });

  it('disables the decision for a Viewer', async () => {
    approval('ap123', { userId: 'u-sam' });
    expect(await screen.findByText(/As a Client Viewer you can view this approval but not decide it/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve$/ })).toBeDisabled();
  });

  it('marks a hidden linked file as no longer shared and keeps the approval readable', async () => {
    approval('ap123', { hiddenIds: ['f2'] });
    expect(await screen.findByText('No longer shared')).toBeInTheDocument();
    expect(screen.getAllByText('Approve homepage wireframe v3').length).toBeGreaterThan(0);
  });

  it('shows free-form details', async () => {
    approval('ap127');
    expect(await screen.findAllByText(/Soft launch to your staff first/)).not.toHaveLength(0);
  });

  it('shows the unavailable page for an approval in a project the person lost', async () => {
    approval('ap121', { userId: 'u-jamie', removedProjects: { 'u-jamie': ['p7'] } });
    expect(await screen.findByText("This item isn't available")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to approvals' })).toBeInTheDocument();
  });

  it('locks the approval discussion for a Viewer', async () => {
    approval('ap123', { userId: 'u-sam' });
    expect(await screen.findByText("Client Viewers can't comment.")).toBeInTheDocument();
  });
});

describe('Change requests list', () => {
  it('shows the stats and rows', async () => {
    renderPortal(<ChangeRequestsPage />, { path: '/change-requests', route: '/change-requests' });
    expect(await screen.findByText('Add a cookie consent banner')).toBeInTheDocument();
    expect(screen.getByText('Needs your reply')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New change request/ })).toBeInTheDocument();
  });

  it('locks "New change request" for a Viewer', async () => {
    renderPortal(<ChangeRequestsPage />, { path: '/change-requests', route: '/change-requests', scenario: { userId: 'u-sam' } });
    expect(await screen.findByText("Client Viewers can't submit change requests.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New change request/ })).not.toBeInTheDocument();
  });

  it('submits a new request and opens it', async () => {
    renderPortal(<ChangeRequestsPage />, { path: '/change-requests', route: '/change-requests' });
    await userEvent.click(await screen.findByRole('button', { name: /New change request/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByPlaceholderText('A short summary of the change'), 'Add dark mode');
    await userEvent.type(within(dialog).getByPlaceholderText('What do you need, and why?'), 'Dark theme for the whole site');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/change-requests\/cr/));
  });

  it('keeps typed fields and the attachment after upload confirms (projects list refetch)', async () => {
    renderPortal(<ChangeRequestsPage />, { path: '/change-requests', route: '/change-requests' });
    await userEvent.click(await screen.findByRole('button', { name: /New change request/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByPlaceholderText('A short summary of the change'), 'Keep my title');
    const file = new File(['hello'], 'brief.pdf', { type: 'application/pdf' });
    await userEvent.upload(within(dialog).getByTestId('cr-attachment-input'), file);
    expect(await within(dialog).findByText('brief.pdf')).toBeInTheDocument();
    // confirmUpload invalidates V2Projects; a buggy reset effect would clear the form here.
    await waitFor(() => {
      expect(within(dialog).getByDisplayValue('Keep my title')).toBeInTheDocument();
      expect(within(dialog).getByText('brief.pdf')).toBeInTheDocument();
    });
  });
});

describe('Change request detail', () => {
  it('shows "No estimate yet" instead of a zero', async () => {
    changeRequest('cr8');
    expect(await screen.findByText(/No estimate yet/)).toBeInTheDocument();
  });

  it('shows the estimate when there is one', async () => {
    changeRequest('cr6');
    expect(await screen.findByText('12 h · $960')).toBeInTheDocument();
  });

  it('lets the requester send the information a team asked for', async () => {
    changeRequest('cr7', { userId: 'u-jamie' });
    const box = await screen.findByPlaceholderText('Add the information they asked for…');
    await userEvent.type(box, 'Pro plan, double opt-in please');
    await userEvent.click(screen.getByRole('button', { name: 'Send information' }));
    expect(await screen.findByText('Pro plan, double opt-in please')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByPlaceholderText('Add the information they asked for…')).not.toBeInTheDocument());
  });

  it('locks the reply for a Viewer', async () => {
    changeRequest('cr7', { userId: 'u-sam' });
    expect(await screen.findByText("Client Viewers can't reply to change requests.")).toBeInTheDocument();
  });

  it('cancels after a confirmation', async () => {
    changeRequest('cr9', { userId: 'u-jamie' });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel this request' }));
    const dialog = (await screen.findByText('Cancel request', { selector: 'span' })).closest('.ant-modal') as HTMLElement;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel request' }));
    expect(await screen.findByText('This request was cancelled.')).toBeInTheDocument();
  });

  it('does not offer cancel on a closed request', async () => {
    changeRequest('cr4');
    await screen.findAllByText('Update footer legal links');
    expect(screen.queryByRole('button', { name: 'Cancel this request' })).not.toBeInTheDocument();
  });

  it('shows the unavailable page for a missing request', async () => {
    changeRequest('nope');
    expect(await screen.findByText("This item isn't available")).toBeInTheDocument();
  });
});
