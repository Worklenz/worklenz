import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { AnalyticsFilterBar } from './AnalyticsFilterBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: Record<string, string>) =>
      opts?.defaultValue?.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => opts[key] ?? '') ??
      _key,
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
  it('restores defaultTeamIds on Clear instead of emptying teams', () => {
    const { onProjectsChange, onTeamsChange } = renderBar();

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onProjectsChange).toHaveBeenCalledWith([]);
    expect(onTeamsChange).toHaveBeenCalledWith(['t-default']);
    expect(onTeamsChange).not.toHaveBeenCalledWith([]);
  });

  it('shows all report filters inside the compact Filter popover', () => {
    renderBar({
      selectedProjectIds: [],
      selectedTeamIds: ['t-default'],
      memberOptions: [{ value: 'm1', label: 'Alex' }],
      selectedMemberIds: [],
      onMembersChange: vi.fn(),
      datePreset: 'last_30_days',
      onDatePresetChange: vi.fn(),
      statusOptions: [{ value: 'open', label: 'Open' }],
      selectedStatusIds: [],
      onStatusesChange: vi.fn(),
      includeDone: false,
      onIncludeDoneChange: vi.fn(),
    });

    const filterButton = screen.getByRole('button', { name: 'Filter' });
    expect(filterButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Projects/ })).not.toBeInTheDocument();

    fireEvent.click(filterButton);

    const filterPopover = screen.getByRole('tooltip');
    expect(within(filterPopover).getByRole('button', { name: /Projects/ })).toBeInTheDocument();
    expect(within(filterPopover).getByRole('button', { name: /Members/ })).toBeInTheDocument();
    expect(within(filterPopover).getByRole('button', { name: /Teams/ })).toBeInTheDocument();
    expect(within(filterPopover).getByRole('button', { name: 'Date range' })).toBeInTheDocument();
    expect(within(filterPopover).getByRole('button', { name: /Statuses/ })).toBeInTheDocument();
    expect(within(filterPopover).getByText('Hide done')).toBeInTheDocument();
    expect(within(filterPopover).getByText('Show done')).toBeInTheDocument();
  });

  it('enables Clear when every team is removed and the default set is nonempty', () => {
    const { onProjectsChange, onTeamsChange } = renderBar({
      selectedProjectIds: [],
      selectedTeamIds: [],
      defaultTeamIds: ['t-default'],
    });

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    const clearButton = screen.getByRole('button', { name: 'Clear' });
    expect(clearButton).toBeEnabled();

    fireEvent.click(clearButton);

    expect(onProjectsChange).toHaveBeenCalledWith([]);
    expect(onTeamsChange).toHaveBeenCalledWith(['t-default']);
  });
});
