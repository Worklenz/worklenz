import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createStatus: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  deleteStatus: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  query: {
    data: { body: [] as { id: string; name: string; color: string }[] },
    isLoading: false,
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

vi.mock('../../../api/client-portal/client-portal-api', () => ({
  useGetRequestCustomStatusesQuery: () => mocks.query,
  useCreateRequestCustomStatusMutation: () => [mocks.createStatus, { isLoading: false }],
  useDeleteRequestCustomStatusMutation: () => [mocks.deleteStatus],
}));

import AddCustomStatusModal from './AddCustomStatusModal';

describe('AddCustomStatusModal', () => {
  beforeEach(() => {
    mocks.createStatus.mockClear();
    mocks.deleteStatus.mockClear();
    mocks.query.data = { body: [] };
    mocks.query.isLoading = false;
  });

  it('rejects an empty name without calling the mutation', async () => {
    render(<AddCustomStatusModal open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

    expect(mocks.createStatus).not.toHaveBeenCalled();
    expect(await screen.findByText('Enter a status name')).toBeInTheDocument();
  });

  it('adds a status with the default color when none is picked', async () => {
    render(<AddCustomStatusModal open onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Awaiting Client'), {
      target: { value: '  Awaiting Client  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

    expect(mocks.createStatus).toHaveBeenCalledWith({ name: 'Awaiting Client', color: 'default' });
  });

  it('adds a status with the picked color', async () => {
    render(<AddCustomStatusModal open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'blue' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Awaiting Client'), {
      target: { value: 'On Hold' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

    expect(mocks.createStatus).toHaveBeenCalledWith({ name: 'On Hold', color: 'blue' });
  });

  it('lists existing custom statuses and removes one after confirming', async () => {
    mocks.query.data = {
      body: [{ id: 'status-1', name: 'Awaiting Client', color: 'blue' }],
    };

    render(<AddCustomStatusModal open onClose={() => {}} />);

    expect(screen.getByText('Awaiting Client')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Awaiting Client' }));
    fireEvent.click(await screen.findByText('Delete'));

    expect(mocks.deleteStatus).toHaveBeenCalledWith('status-1');
  });

  it('shows an empty message when there are no custom statuses yet', () => {
    render(<AddCustomStatusModal open onClose={() => {}} />);

    expect(screen.getByText('No custom statuses yet.')).toBeInTheDocument();
  });
});
