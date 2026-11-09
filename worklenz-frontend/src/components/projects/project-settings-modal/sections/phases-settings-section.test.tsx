import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider, Form, theme } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PhasesSettingsSection from './phases-settings-section';

vi.mock('@/shared/antd-imports', async () => import('antd'));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: object) => unknown) =>
    selector({ projectDrawerReducer: { project: null }, phaseReducer: { phaseList: [] } }),
}));
vi.mock('@/components/task-management/ManagePhaseContent', () => ({
  default: () => <div>Phase management</div>,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }),
}));

afterEach(cleanup);

describe.each([['light', theme.defaultAlgorithm], ['dark', theme.darkAlgorithm]])(
  'phase settings during project creation in %s theme', (_mode, algorithm) => {
    it('allows enabling phase assignees while phase management is unavailable', async () => {
      const onFinish = vi.fn();
      render(
        <ConfigProvider theme={{ algorithm }}>
          <Form onFinish={onFinish} initialValues={{ phase_assignees_enabled: false }}>
            <PhasesSettingsSection createPlaceholder={<span>Create the project first</span>} />
            <button type="submit">Save</button>
          </Form>
        </ConfigProvider>
      );
      expect(screen.getByText('Create the project first')).toBeTruthy();
      expect(screen.queryByText('Phase management')).toBeNull();
      fireEvent.click(screen.getByRole('switch', { name: 'Enable Phase Assignees' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({ phase_assignees_enabled: true })
      ));
    });
  }
);
