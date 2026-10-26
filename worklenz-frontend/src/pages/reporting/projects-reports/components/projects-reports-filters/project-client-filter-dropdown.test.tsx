import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider, theme } from 'antd';
import { clientsApiService } from '@/api/clients/clients.api.service';
import ProjectClientFilterDropdown from './project-client-filter-dropdown';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (select: (state: unknown) => unknown) => select({
    themeReducer: { mode: 'light' },
    projectReportsReducer: { selectedClients: [] },
  }),
}));
vi.mock('@/api/clients/clients.api.service', () => ({
  clientsApiService: { getClientsLookup: vi.fn() },
}));
vi.mock('@/features/reporting/projectReports/project-reports-slice', () => ({
  setSelectedClients: vi.fn(), toggleClient: vi.fn(), fetchProjectDataForCurrentView: vi.fn(),
}));

describe('inline client filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientsApiService.getClientsLookup).mockResolvedValue({
      done: true, body: [{ id: 'client-1', name: 'Research &amp; Design' }],
    });
  });

  it.each(['light', 'dark'])('loads browsable clients without typing in %s theme', async mode => {
    render(
      <ConfigProvider theme={{ algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
        <ProjectClientFilterDropdown inline />
      </ConfigProvider>
    );

    expect(await screen.findByText('Research & Design')).toBeInTheDocument();
    await waitFor(() => expect(clientsApiService.getClientsLookup).toHaveBeenCalledWith(''));
    expect(screen.getByRole('checkbox', { name: 'Research & Design' })).toBeEnabled();
  });
});
