import React from 'react';
import { Flex, Segmented, Select } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  MultiSelectFilterPill,
  type FilterOption,
} from '@/components/common/filters/MultiSelectFilterPill';

export type AnalyticsDatePreset =
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_60_days'
  | 'last_90_days'
  | 'this_quarter'
  | 'custom';

export interface AnalyticsFilterBarProps {
  projectOptions: FilterOption[];
  selectedProjectIds: string[];
  onProjectsChange: (ids: string[]) => void;
  memberOptions?: FilterOption[];
  selectedMemberIds?: string[];
  onMembersChange?: (ids: string[]) => void;
  teamOptions?: FilterOption[];
  selectedTeamIds?: string[];
  onTeamsChange?: (ids: string[]) => void;
  datePreset?: AnalyticsDatePreset;
  onDatePresetChange?: (preset: AnalyticsDatePreset) => void;
  statusOptions?: FilterOption[];
  selectedStatusIds?: string[];
  onStatusesChange?: (ids: string[]) => void;
  /** Override label for the status/health multi-select (defaults to Statuses). */
  statusFilterLabel?: string;
  includeDone?: boolean;
  onIncludeDoneChange?: (include: boolean) => void;
  loading?: boolean;
  /** Keep controls on one horizontal row (no wrap). */
  inline?: boolean;
}

export const AnalyticsFilterBar: React.FC<AnalyticsFilterBarProps> = ({
  projectOptions,
  selectedProjectIds,
  onProjectsChange,
  memberOptions = [],
  selectedMemberIds = [],
  onMembersChange,
  teamOptions = [],
  selectedTeamIds = [],
  onTeamsChange,
  datePreset,
  onDatePresetChange,
  statusOptions = [],
  selectedStatusIds = [],
  onStatusesChange,
  statusFilterLabel,
  includeDone,
  onIncludeDoneChange,
  loading,
  inline = false,
}) => {
  const { t } = useTranslation('reporting-analytics');

  return (
    <Flex gap={8} wrap={inline ? 'nowrap' : 'wrap'} align="center" style={inline ? { flexShrink: 0 } : undefined}>
      <MultiSelectFilterPill
        label={t('filterProjects', { defaultValue: 'Projects' })}
        options={projectOptions}
        value={selectedProjectIds}
        onChange={onProjectsChange}
        loading={loading}
        showBulkActions
        searchPlaceholder={t('searchProjects', { defaultValue: 'Search projects' })}
        emptyText={t('noProjects', { defaultValue: 'No projects found' })}
      />

      {onMembersChange && (
        <MultiSelectFilterPill
          label={t('filterMembers', { defaultValue: 'Members' })}
          options={memberOptions}
          value={selectedMemberIds}
          onChange={onMembersChange}
          loading={loading}
          searchPlaceholder={t('searchMembers', { defaultValue: 'Search members' })}
          emptyText={t('noMembers', { defaultValue: 'No members found' })}
        />
      )}

      {onTeamsChange && (
        <MultiSelectFilterPill
          label={t('filterTeams', { defaultValue: 'Teams' })}
          options={teamOptions}
          value={selectedTeamIds}
          onChange={onTeamsChange}
          loading={loading}
          showBulkActions
          searchPlaceholder={t('searchTeams', { defaultValue: 'Search teams' })}
          emptyText={t('noTeams', { defaultValue: 'No teams found' })}
        />
      )}

      {datePreset && onDatePresetChange && (
        <Select
          value={datePreset}
          onChange={onDatePresetChange}
          style={{ minWidth: 160 }}
          options={[
            { value: 'last_7_days', label: t('dateLast7', { defaultValue: 'Last 7 days' }) },
            { value: 'last_14_days', label: t('dateLast14', { defaultValue: 'Last 14 days' }) },
            { value: 'last_30_days', label: t('dateLast30', { defaultValue: 'Last 30 days' }) },
            { value: 'last_60_days', label: t('dateLast60', { defaultValue: 'Last 60 days' }) },
            { value: 'last_90_days', label: t('dateLast90', { defaultValue: 'Last 90 days' }) },
            { value: 'this_quarter', label: t('dateThisQuarter', { defaultValue: 'This quarter' }) },
            { value: 'custom', label: t('dateCustom', { defaultValue: 'Custom' }) },
          ]}
          aria-label={t('datePreset', { defaultValue: 'Date range' })}
        />
      )}

      {onStatusesChange && statusOptions.length > 0 && (
        <MultiSelectFilterPill
          label={
            statusFilterLabel ?? t('filterStatuses', { defaultValue: 'Statuses' })
          }
          options={statusOptions}
          value={selectedStatusIds}
          onChange={onStatusesChange}
          loading={loading}
          searchPlaceholder={t('searchStatuses', { defaultValue: 'Search statuses' })}
          emptyText={t('noStatuses', { defaultValue: 'No statuses found' })}
        />
      )}

      {typeof includeDone === 'boolean' && onIncludeDoneChange && (
        <Segmented
          value={includeDone ? 'include' : 'exclude'}
          onChange={val => onIncludeDoneChange(val === 'include')}
          options={[
            {
              value: 'exclude',
              label: t('excludeDone', { defaultValue: 'Hide done' }),
            },
            {
              value: 'include',
              label: t('includeDone', { defaultValue: 'Show done' }),
            },
          ]}
        />
      )}
    </Flex>
  );
};
