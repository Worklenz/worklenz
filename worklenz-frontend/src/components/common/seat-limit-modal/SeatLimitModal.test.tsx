import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider, theme } from 'antd';
import { SeatLimitModal } from './SeatLimitModal';

vi.mock('@/shared/antd-imports', async () => import('antd'));
vi.mock('@/hooks/useAppSumoTracking', () => ({
  useAppSumoTracking: () => ({ trackAppSumoEvent: vi.fn() }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string; planLimit?: number; businessLimit?: number }) =>
      options.defaultValue.replace('{{planLimit}}', String(options.planLimit)).replace('{{businessLimit}}', String(options.businessLimit)),
  }),
}));

afterEach(cleanup);

describe.each([['light', theme.defaultAlgorithm], ['dark', theme.darkAlgorithm]])(
  'seat limit dialog in %s theme', (_mode, algorithm) => {
    it('explains the lifetime deal limit and offers deactivation', () => {
      const deactivate = vi.fn();
      render(
        <ConfigProvider theme={{ algorithm }}>
          <SeatLimitModal open onClose={vi.fn()} currentMembers={5} planLimit={5}
            businessLimit={50} isAppSumoUser onUpgrade={vi.fn()} onDeactivate={deactivate} />
        </ConfigProvider>
      );

      expect(screen.getByText(/lifetime deal includes 5 members/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Deactivate member/i }));
      expect(deactivate).toHaveBeenCalledOnce();
    });
  }
);
