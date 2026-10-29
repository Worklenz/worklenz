import React from 'react';
import {
  Badge,
  Button,
  Divider,
  Flex,
  Popover,
  Segmented,
  Select,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  FILTER_PILL_BUTTON_STYLE,
  MultiSelectFilterPill,
  type FilterOption,
} from '@/components/common/filters/MultiSelectFilterPill';

const { Text } = Typography;

export type AnalyticsDatePreset =
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_60_days'
  | 'last_90_days'
  | 'this_quarter'
  | 'custom';

const ALL_DATE_PRESETS: AnalyticsDatePreset[] = [
  'last_7_days',
  'last_14_days',
  'last_30_days',
  'last_60_days',
  'last_90_days',
  'this_quarter',
  'custom',
];

export interface AnalyticsFilterBarProps {
  projectOptions: FilterOption[];
  selectedProjectIds: string[];
  onProjectsChange: (ids: string[]) => void;
  /** Projects currently shown on the chart — checkboxes appear marked when no explicit filter is set. */
  indicatedProjectIds?: string[];
  memberOptions?: FilterOption[];
  selectedMemberIds?: string[];
  onMembersChange?: (ids: string[]) => void;
  teamOptions?: FilterOption[];
  selectedTeamIds?: string[];
  onTeamsChange?: (ids: string[]) => void;
  datePreset?: AnalyticsDatePreset;
  onDatePresetChange?: (preset: AnalyticsDatePreset) => void;
  /** Limit which date presets appear (defaults to all). */
  availableDatePresets?: AnalyticsDatePreset[];
  /** Used for badge count + Clear; defaults to last_30_days. */
  defaultDatePreset?: AnalyticsDatePreset;
  statusOptions?: FilterOption[];
  selectedStatusIds?: string[];
  onStatusesChange?: (ids: string[]) => void;
  /** Override label for the status/health multi-select (defaults to Statuses). */
  statusFilterLabel?: string;
  includeDone?: boolean;
  onIncludeDoneChange?: (include: boolean) => void;
  loading?: boolean;
  /** @deprecated Unused — filters live inside a single Filter popover. */
  inline?: boolean;
}

/**
 * Reporting filter control matching Time Entries: one Filter button that opens
 * a popover with all attribute filters. Selections are staged until Apply.
 */
export const AnalyticsFilterBar: React.FC<AnalyticsFilterBarProps> = ({
  projectOptions,
  selectedProjectIds,
  onProjectsChange,
  indicatedProjectIds = [],
  memberOptions = [],
  selectedMemberIds = [],
  onMembersChange,
  teamOptions = [],
  selectedTeamIds = [],
  onTeamsChange,
  datePreset,
  onDatePresetChange,
  availableDatePresets = ALL_DATE_PRESETS,
  defaultDatePreset = 'last_30_days',
  statusOptions = [],
  selectedStatusIds = [],
  onStatusesChange,
  statusFilterLabel,
  includeDone,
  onIncludeDoneChange,
  loading,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const [panelOpen, setPanelOpen] = React.useState(false);

  const showMembers = Boolean(onMembersChange);
  const showTeams = Boolean(onTeamsChange);
  const showDate = Boolean(datePreset && onDatePresetChange);
  const showStatuses = Boolean(onStatusesChange && statusOptions.length > 0);
  const showIncludeDone =
    typeof includeDone === 'boolean' && Boolean(onIncludeDoneChange);

  const [draftProjectIds, setDraftProjectIds] = React.useState(selectedProjectIds);
  const [draftMemberIds, setDraftMemberIds] = React.useState(selectedMemberIds);
  const [draftTeamIds, setDraftTeamIds] = React.useState(selectedTeamIds);
  const [draftDatePreset, setDraftDatePreset] = React.useState(
    datePreset ?? defaultDatePreset
  );
  const [draftStatusIds, setDraftStatusIds] = React.useState(selectedStatusIds);
  const [draftIncludeDone, setDraftIncludeDone] = React.useState(includeDone ?? false);

  React.useEffect(() => {
    if (!panelOpen) return;
    setDraftProjectIds(selectedProjectIds);
    setDraftMemberIds(selectedMemberIds);
    setDraftTeamIds(selectedTeamIds);
    setDraftDatePreset(datePreset ?? defaultDatePreset);
    setDraftStatusIds(selectedStatusIds);
    setDraftIncludeDone(includeDone ?? false);
    // Re-sync drafts only when the panel opens (same pattern as Time Entries).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedProjectIds.length > 0) count++;
    if (showMembers && selectedMemberIds.length > 0) count++;
    if (showTeams && selectedTeamIds.length > 0) count++;
    if (showDate && datePreset && datePreset !== defaultDatePreset) count++;
    if (showStatuses && selectedStatusIds.length > 0) count++;
    if (showIncludeDone && includeDone) count++;
    return count;
  }, [
    selectedProjectIds,
    showMembers,
    selectedMemberIds,
    showTeams,
    selectedTeamIds,
    showDate,
    datePreset,
    defaultDatePreset,
    showStatuses,
    selectedStatusIds,
    showIncludeDone,
    includeDone,
  ]);

  const hasDraftFilters =
    draftProjectIds.length > 0 ||
    (showMembers && draftMemberIds.length > 0) ||
    (showTeams && draftTeamIds.length > 0) ||
    (showDate && draftDatePreset !== defaultDatePreset) ||
    (showStatuses && draftStatusIds.length > 0) ||
    (showIncludeDone && draftIncludeDone);

  const handleApply = () => {
    onProjectsChange(draftProjectIds);
    if (onMembersChange) onMembersChange(draftMemberIds);
    if (onTeamsChange) onTeamsChange(draftTeamIds);
    if (onDatePresetChange) onDatePresetChange(draftDatePreset);
    if (onStatusesChange) onStatusesChange(draftStatusIds);
    if (onIncludeDoneChange) onIncludeDoneChange(draftIncludeDone);
    setPanelOpen(false);
  };

  const handleClearAll = () => {
    setDraftProjectIds([]);
    setDraftMemberIds([]);
    setDraftTeamIds([]);
    setDraftDatePreset(defaultDatePreset);
    setDraftStatusIds([]);
    setDraftIncludeDone(false);

    onProjectsChange([]);
    if (onMembersChange) onMembersChange([]);
    if (onTeamsChange) onTeamsChange([]);
    if (onDatePresetChange) onDatePresetChange(defaultDatePreset);
    if (onStatusesChange) onStatusesChange([]);
    if (onIncludeDoneChange) onIncludeDoneChange(false);
    setPanelOpen(false);
  };

  const dateOptions = availableDatePresets.map(value => {
    const labels: Record<AnalyticsDatePreset, string> = {
      last_7_days: t('dateLast7', { defaultValue: 'Last 7 days' }),
      last_14_days: t('dateLast14', { defaultValue: 'Last 14 days' }),
      last_30_days: t('dateLast30', { defaultValue: 'Last 30 days' }),
      last_60_days: t('dateLast60', { defaultValue: 'Last 60 days' }),
      last_90_days: t('dateLast90', { defaultValue: 'Last 90 days' }),
      this_quarter: t('dateThisQuarter', { defaultValue: 'This quarter' }),
      custom: t('dateCustom', { defaultValue: 'Custom' }),
    };
    return { value, label: labels[value] };
  });

  const panelContent = (
    <div style={{ width: 'min(420px, calc(100vw - 32px))', padding: '4px 0' }}>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
        {t('filtersTitle', { defaultValue: 'Filters' })}
      </Text>

      <Flex gap={8} wrap="wrap" align="center">
        {showDate && (
          <Select
            value={draftDatePreset}
            onChange={setDraftDatePreset}
            options={dateOptions}
            style={{ minWidth: 160 }}
            aria-label={t('datePreset', { defaultValue: 'Date range' })}
          />
        )}

        <MultiSelectFilterPill
          label={t('filterProjects', { defaultValue: 'Projects' })}
          options={projectOptions}
          value={draftProjectIds}
          onChange={setDraftProjectIds}
          indicatedValues={indicatedProjectIds}
          loading={loading}
          showBulkActions
          searchPlaceholder={t('searchProjects', { defaultValue: 'Search projects' })}
          emptyText={t('noProjects', { defaultValue: 'No projects found' })}
        />

        {showMembers && (
          <MultiSelectFilterPill
            label={t('filterMembers', { defaultValue: 'Members' })}
            options={memberOptions}
            value={draftMemberIds}
            onChange={setDraftMemberIds}
            loading={loading}
            searchPlaceholder={t('searchMembers', { defaultValue: 'Search members' })}
            emptyText={t('noMembers', { defaultValue: 'No members found' })}
          />
        )}

        {showTeams && (
          <MultiSelectFilterPill
            label={t('filterTeams', { defaultValue: 'Teams' })}
            options={teamOptions}
            value={draftTeamIds}
            onChange={setDraftTeamIds}
            loading={loading}
            showBulkActions
            searchPlaceholder={t('searchTeams', { defaultValue: 'Search teams' })}
            emptyText={t('noTeams', { defaultValue: 'No teams found' })}
          />
        )}

        {showStatuses && (
          <MultiSelectFilterPill
            label={
              statusFilterLabel ?? t('filterStatuses', { defaultValue: 'Statuses' })
            }
            options={statusOptions}
            value={draftStatusIds}
            onChange={setDraftStatusIds}
            loading={loading}
            searchPlaceholder={t('searchStatuses', { defaultValue: 'Search statuses' })}
            emptyText={t('noStatuses', { defaultValue: 'No statuses found' })}
          />
        )}

        {showIncludeDone && (
          <Segmented
            value={draftIncludeDone ? 'include' : 'exclude'}
            onChange={val => setDraftIncludeDone(val === 'include')}
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

      <Divider style={{ margin: '12px 0' }} />

      <Flex justify="space-between" align="center">
        <Button
          size="small"
          disabled={!hasDraftFilters}
          onClick={handleClearAll}
          style={{ borderRadius: 7 }}
        >
          {t('clearFilters', { defaultValue: 'Clear' })}
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={handleApply}
          style={{ borderRadius: 7 }}
        >
          {t('applyFilters', { defaultValue: 'Apply' })}
        </Button>
      </Flex>
    </div>
  );

  return (
    <Popover
      content={panelContent}
      trigger="click"
      placement="bottomLeft"
      open={panelOpen}
      onOpenChange={setPanelOpen}
      styles={{ root: { padding: 0 }, body: { padding: '12px 16px', borderRadius: 8 } }}
    >
      <Button
        icon={<FilterOutlined />}
        style={
          panelOpen || activeFilterCount > 0
            ? {
                ...FILTER_PILL_BUTTON_STYLE,
                borderColor: token.colorPrimary,
                color: token.colorPrimary,
              }
            : FILTER_PILL_BUTTON_STYLE
        }
        aria-label={
          activeFilterCount > 0
            ? `${t('filterButton', { defaultValue: 'Filter' })} (${activeFilterCount})`
            : t('filterButton', { defaultValue: 'Filter' })
        }
        aria-expanded={panelOpen}
      >
        {t('filterButton', { defaultValue: 'Filter' })}
        {activeFilterCount > 0 && (
          <Badge
            count={activeFilterCount}
            size="small"
            style={{ marginLeft: 4, backgroundColor: token.colorPrimary }}
          />
        )}
      </Button>
    </Popover>
  );
};
