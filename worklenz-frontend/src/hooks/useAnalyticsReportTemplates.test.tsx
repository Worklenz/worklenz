import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnalyticsReportTemplates } from './useAnalyticsReportTemplates';
import { usePersistedAnalyticsFilters } from './usePersistedAnalyticsFilters';

vi.mock('@/utils/session-helper', () => ({ getUserSession: () => ({ id: 'user-1', team_id: 'team-1' }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/reporting/analytics-custom-reports', () => ({
  getAnalyticsCustomReportsStorageKey: () => 'scope',
  isAnalyticsCustomReportsSessionActive: () => true,
  syncTemplatesToCustomReports: vi.fn(),
}));
vi.mock('@/api/reporting/analytics-templates.api.service', () => ({
  analyticsTemplatesApiService: { listTemplates: vi.fn(async () => ({ done: true, body: [{ id: 'tpl-1', filters_json: { project_ids: ['saved'] } }] })) },
}));

describe('custom report template restoration', () => {
  beforeEach(() => sessionStorage.clear());

  it('applies the template on first open and preserves edits after remount', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
    const useReport = () => {
      const filters = usePersistedAnalyticsFilters({ reportKind: 'test', customTemplateId: 'tpl-1' });
      useAnalyticsReportTemplates({
        reportKind: 'test', customTemplateId: 'tpl-1', wasRestored: filters.wasRestored,
        onApply: template => filters.setSelectedProjectIds(template.filters_json?.project_ids as string[]),
        getFilters: () => ({}),
      });
      return filters;
    };
    const first = renderHook(useReport, { wrapper });
    await waitFor(() => expect(first.result.current.selectedProjectIds).toEqual(['saved']));
    act(() => first.result.current.setSelectedProjectIds(['edited']));
    first.unmount();
    const second = renderHook(useReport, { wrapper });
    await waitFor(() => expect(second.result.current.selectedProjectIds).toEqual(['edited']));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(second.result.current.selectedProjectIds).toEqual(['edited']);
  });
});
