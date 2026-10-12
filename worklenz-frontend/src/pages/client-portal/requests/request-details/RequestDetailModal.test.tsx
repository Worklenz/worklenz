import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  request: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
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

vi.mock('../../../../api/client-portal/client-portal-api', () => ({
  useGetRequestDetailsQuery: () => ({ ...mocks.request, refetch: mocks.refetch }),
  useUpdateOrganizationRequestStatusMutation: () => [vi.fn(), { isLoading: false }],
  useGetRequestCommentsQuery: () => ({ data: undefined, refetch: vi.fn() }),
  useAddRequestCommentMutation: () => [vi.fn(), { isLoading: false }],
  useGetInvoicesByRequestQuery: () => ({ data: undefined }),
}));

import RequestDetailModal from './RequestDetailModal';

const SELECTED_REQUEST = {
  id: 'req-1',
  req_no: 'REQ-0001',
  status: 'pending',
  service_name: 'Landing Page Design',
  client_name: 'TechFlow Inc',
  created_at: '2026-01-01T00:00:00.000Z',
  notes: null,
  request_data: {
    title: 'Need to design website',
    description: 'This is a 5 page website',
    priority: 'High',
    questionAnswers: [],
    attachments: [],
  },
};

const renderModal = (
  initialEntries: string[] = ['/worklenz/client-portal/requests/req-1'],
  initialIndex = 0
) =>
  render(
    <MemoryRouter
      initialEntries={initialEntries.map((pathname, index) => ({
        pathname,
        key: index === 0 ? 'default' : `entry-${index}`,
      }))}
      initialIndex={initialIndex}
    >
      <Routes>
        <Route path="/worklenz/client-portal/requests/:id" element={<RequestDetailModal />} />
        <Route path="/worklenz/client-portal/requests" element={<div>requests list</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('RequestDetailModal', () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.request.data = undefined;
    mocks.request.isLoading = false;
    mocks.request.isError = false;
    mocks.request.error = undefined;
  });

  it('shows a loading state before the tabs render', () => {
    mocks.request.isLoading = true;

    renderModal();

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('says so when the request does not exist, with a way back', () => {
    mocks.request.isError = true;
    mocks.request.error = { status: 404 };

    renderModal();

    expect(screen.getByText('Request not found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Requests' }));
    expect(screen.getByText('requests list')).toBeInTheDocument();
  });

  it('offers a retry for any other failure', () => {
    mocks.request.isError = true;
    mocks.request.error = { status: 500 };

    renderModal();

    expect(screen.getByText("Couldn't load this request")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('renders the request once loaded', () => {
    mocks.request.data = { body: SELECTED_REQUEST };

    renderModal();

    expect(screen.getByText('REQ-0001', { exact: false })).toBeInTheDocument();
    // The real i18n bundle has a "Submission" label; the mocked t() used here falls back to the
    // raw key ("submissionTab") since this call site doesn't pass a defaultValue.
    expect(screen.getByRole('tab', { name: /submissionTab/ })).toBeInTheDocument();
  });

  it('closes to the list when the modal was opened directly', () => {
    mocks.request.data = { body: SELECTED_REQUEST };

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByText('requests list')).toBeInTheDocument();
  });

  it('closes to the previous page when the modal was opened from the list', () => {
    mocks.request.data = { body: SELECTED_REQUEST };

    renderModal(['/worklenz/client-portal/requests', '/worklenz/client-portal/requests/req-1'], 1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByText('requests list')).toBeInTheDocument();
  });
});
