import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { AnalyticsFilterBar } from './AnalyticsFilterBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ themeReducer: { mode: 'light' } }),
}));

vi.mock('@/shared/antd-imports', async () => {
  const antd = await import('antd');
  const icons = await import('@ant-design/icons');
  return { ...antd, ...icons };
});

const PROJECT_OPTIONS = [
  { value: 'p1', label: 'Alpha' },
  { value: 'p2', label: 'Beta' },
];

const TEAM_OPTIONS = [
  { value: 't-default', label: 'Default Team' },
  { value: 't-other', label: 'Other Team' },
];

const renderBar = (props: Partial<React.ComponentProps<typeof AnalyticsFilterBar>> = {}) => {
  const onProjectsChange = vi.fn();
  const onTeamsChange = vi.fn();
  const utils = render(
    <ConfigProvider>
      <AnalyticsFilterBar
        projectOptions={PROJECT_OPTIONS}
        selectedProjectIds={['p1']}
        onProjectsChange={onProjectsChange}
        teamOptions={TEAM_OPTIONS}
        selectedTeamIds={['t-other']}
        onTeamsChange={onTeamsChange}
        defaultTeamIds={['t-default']}
        {...props}
      />
    </ConfigProvider>
  );
  return { onProjectsChange, onTeamsChange, ...utils };
};

describe('AnalyticsFilterBar', () => {
  it('restores defaultTeamIds on Clear instead of emptying teams', async () => {
    const { onProjectsChange, onTeamsChange } = renderBar();

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));

    expect(onProjectsChange).toHaveBeenCalledWith([]);
    expect(onTeamsChange).toHaveBeenCalledWith(['t-default']);
    expect(onTeamsChange).not.toHaveBeenCalledWith([]);
  });

  it('does not treat the default team alone as an active filter', () => {
    renderBar({
      selectedProjectIds: [],
      selectedTeamIds: ['t-default'],
    });

    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });
});
