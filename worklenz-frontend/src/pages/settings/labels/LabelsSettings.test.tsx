import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LabelsSettings from './LabelsSettings';

const mocks = vi.hoisted(() => ({ getLabels: vi.fn(), track: vi.fn() }));

vi.mock('@/shared/antd-imports', async () => ({
  ...(await import('antd')),
  ...(await import('@ant-design/icons')),
}));
vi.mock('@/api/taskAttributes/labels/labels.api.service', () => ({
  labelsApiService: { getLabels: mocks.getLabels },
}));
vi.mock('@/hooks/useMixpanelTracking', () => ({ useMixpanelTracking: () => ({ trackMixpanelEvent: mocks.track }) }));
vi.mock('@/hooks/useDoumentTItle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('@/app/store', () => ({ useAppSelector: () => 'light' }));
vi.mock('@/components/PinRouteToNavbarButton', () => ({ default: () => null }));
vi.mock('@components/task-list-common/labelsSelector/custom-color-label', () => ({
  default: ({ label }: { label: { name: string } }) => <span>{label.name}</span>,
}));
vi.mock('./labels-drawer', () => ({
  default: ({ drawerOpen, drawerClosed }: { drawerOpen: boolean; drawerClosed: () => void }) =>
    drawerOpen ? <button onClick={drawerClosed}>Close drawer</button> : null,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) =>
      typeof options === 'string' ? options : options?.defaultValue ?? key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('label pagination', () => {
  it('stays on the displayed page after the last page disappears and returns', async () => {
    const labels = Array.from({ length: 21 }, (_, index) => ({
      id: String(index), name: `Label ${index + 1}`, usage: 0,
    }));
    mocks.getLabels
      .mockResolvedValueOnce({ done: true, body: labels })
      .mockResolvedValueOnce({ done: true, body: labels.slice(0, 20) })
      .mockResolvedValueOnce({ done: true, body: labels });

    render(<LabelsSettings />);
    await screen.findByText('Label 1');
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByText('Label 21')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Label' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page'));

    fireEvent.click(screen.getByRole('button', { name: 'Create Label' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Label 11')).toBeInTheDocument();
  });
});
