import { cleanup, render, screen } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VelocityTable } from './VelocityTable';

vi.mock('@/shared/antd-imports', async () => ({
  ...(await import('antd')),
  ...(await import('@ant-design/icons')),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));

afterEach(cleanup);

for (const [mode, algorithm] of [['light', theme.defaultAlgorithm], ['dark', theme.darkAlgorithm]] as const) {
  describe(`velocity table in ${mode} theme`, () => {
    it('keeps the heading stable as project types change and retains their empty messages', () => {
      const table = (bucket?: 'sprint' | 'phase' | 'mixed') => (
        <ConfigProvider theme={{ algorithm }}>
          <VelocityTable series={[]} bucket={bucket} />
        </ConfigProvider>
      );
      const { rerender } = render(table());
      expect(screen.getByRole('columnheader', { name: 'Sprint / Phase' })).toBeInTheDocument();
      expect(screen.getByText('No completed sprints match these filters.')).toBeInTheDocument();

      rerender(table('phase'));
      expect(screen.getByRole('columnheader', { name: 'Sprint / Phase' })).toBeInTheDocument();
      expect(screen.getByText('No phases with tasks match these filters.')).toBeInTheDocument();

      rerender(table('mixed'));
      expect(screen.getByRole('columnheader', { name: 'Sprint / Phase' })).toBeInTheDocument();
      expect(screen.getByText('No completed sprints or phases match these filters.')).toBeInTheDocument();

      rerender(table('sprint'));
      expect(screen.getByRole('columnheader', { name: 'Sprint / Phase' })).toBeInTheDocument();
      expect(screen.getByText('No completed sprints match these filters.')).toBeInTheDocument();
    });
  });
}
