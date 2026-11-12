import React from 'react';
import { Badge, Button, Divider, Flex, Segmented, theme } from '@/shared/antd-imports';
import { FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  FILTER_PILL_BUTTON_STYLE,
  FILTER_PILL_CONTROL_STYLE,
  MultiSelectFilterPill,
  SingleSelectFilterPill,
  type FilterOption,
} from '@/components/common/filters/MultiSelectFilterPill';
import { ReportHeaderFilterContext } from '../ReportHeaderFilterContext';

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

const EMPTY_IDS: string[] = [];
const EMPTY_OPTIONS: FilterOption[] = [];
const FILTER_TRIGGER_STYLE = FILTER_PILL_BUTTON_STYLE;

const areSameIdSets = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
};

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
  /**
   * Team IDs restored on Clear.
   * Analytics pages that scope projects by team should pass the session/default team
   * so Clear does not empty the Projects dropdown.
   */
  defaultTeamIds?: string[];
  datePreset?: AnalyticsDatePreset;
  onDatePresetChange?: (preset: AnalyticsDatePreset) => void;
  /** Limit which date presets appear (defaults to all). */
  availableDatePresets?: AnalyticsDatePreset[];
  /** Used for Clear; defaults to last_30_days. */
  defaultDatePreset?: AnalyticsDatePreset;
  statusOptions?: FilterOption[];
  selectedStatusIds?: string[];
  onStatusesChange?: (ids: string[]) => void;
  /** Override label for the status/health multi-select (defaults to Statuses). */
  statusFilterLabel?: string;
  includeDone?: boolean;
  onIncludeDoneChange?: (include: boolean) => void;
  loading?: boolean;
  /** @deprecated Unused. */
  inline?: boolean;
}

/**
 * Compact report-header filter button with staged filter controls in a popover.
 */
export const AnalyticsFilterBar: React.FC<AnalyticsFilterBarProps> = ({
  projectOptions,
  selectedProjectIds,
  onProjectsChange,
  indicatedProjectIds = [],
  memberOptions = EMPTY_OPTIONS,
  selectedMemberIds = EMPTY_IDS,
  onMembersChange,
  teamOptions = EMPTY_OPTIONS,
  selectedTeamIds = EMPTY_IDS,
  onTeamsChange,
  defaultTeamIds = EMPTY_IDS,
  datePreset,
  onDatePresetChange,
  availableDatePresets = ALL_DATE_PRESETS,
  defaultDatePreset = 'last_30_days',
  statusOptions = EMPTY_OPTIONS,
  selectedStatusIds = EMPTY_IDS,
  onStatusesChange,
  statusFilterLabel,
  includeDone,
  onIncludeDoneChange,
  loading,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const filterContext = React.useContext(ReportHeaderFilterContext);
  const [localPanelOpen, setLocalPanelOpen] = React.useState(false);
  const panelOpen = filterContext?.isExpanded ?? localPanelOpen;
  const setPanelOpen = (open: boolean) => {
    if (filterContext) {
      filterContext.setExpanded(open);
    } else {
      setLocalPanelOpen(open);
    }
  };

  const showMembers = Boolean(onMembersChange);
  const showTeams = Boolean(onTeamsChange);
  const showDate = Boolean(datePreset && onDatePresetChange);
  const showStatuses = Boolean(onStatusesChange && statusOptions.length > 0);
  const showIncludeDone = typeof includeDone === 'boolean' && Boolean(onIncludeDoneChange);

  const isDefaultTeamSelection = React.useCallback(
    (ids: string[]) => areSameIdSets(ids, defaultTeamIds),
    [defaultTeamIds]
  );

  const [draftProjectIds, setDraftProjectIds] = React.useState(selectedProjectIds);
  const [draftMemberIds, setDraftMemberIds] = React.useState(selectedMemberIds);
  const [draftTeamIds, setDraftTeamIds] = React.useState(selectedTeamIds);
  const [draftDatePreset, setDraftDatePreset] = React.useState(datePreset ?? defaultDatePreset);
  const [draftStatusIds, setDraftStatusIds] = React.useState(selectedStatusIds);
  const [draftIncludeDone, setDraftIncludeDone] = React.useState(includeDone ?? false);

  // Keep staged controls in sync when a saved custom report loads its filter values.
  React.useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setDraftProjectIds(selectedProjectIds);
    setDraftMemberIds(selectedMemberIds);
    setDraftTeamIds(selectedTeamIds);
    setDraftDatePreset(datePreset ?? defaultDatePreset);
    setDraftStatusIds(selectedStatusIds);
    setDraftIncludeDone(includeDone ?? false);
  }, [
    selectedProjectIds,
    selectedMemberIds,
    selectedTeamIds,
    datePreset,
    defaultDatePreset,
    selectedStatusIds,
    includeDone,
  ]);

  const hasDraftFilters =
    draftProjectIds.length > 0 ||
    (showMembers && draftMemberIds.length > 0) ||
    (showTeams && !isDefaultTeamSelection(draftTeamIds)) ||
    (showDate && draftDatePreset !== defaultDatePreset) ||
    (showStatuses && draftStatusIds.length > 0) ||
    (showIncludeDone && draftIncludeDone);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedProjectIds.length > 0) count++;
    if (showMembers && selectedMemberIds.length > 0) count++;
    if (showTeams && !isDefaultTeamSelection(selectedTeamIds)) count++;
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
    isDefaultTeamSelection,
    showDate,
    datePreset,
    defaultDatePreset,
    showStatuses,
    selectedStatusIds,
    showIncludeDone,
    includeDone,
  ]);

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
    const resetTeamIds = defaultTeamIds;

    setDraftProjectIds([]);
    setDraftMemberIds([]);
    setDraftTeamIds(resetTeamIds);
    setDraftDatePreset(defaultDatePreset);
    setDraftStatusIds([]);
    setDraftIncludeDone(false);

    onProjectsChange([]);
    if (onMembersChange) onMembersChange([]);
    if (onTeamsChange) onTeamsChange(resetTeamIds);
    if (onDatePresetChange) onDatePresetChange(defaultDatePreset);
    if (onStatusesChange) onStatusesChange([]);
    if (onIncludeDoneChange) onIncludeDoneChange(false);
    setPanelOpen(false);
  };

  const dateLabels: Record<AnalyticsDatePreset, string> = {
    last_7_days: t('dateLast7', { defaultValue: 'Last 7 days' }),
    last_14_days: t('dateLast14', { defaultValue: 'Last 14 days' }),
    last_30_days: t('dateLast30', { defaultValue: 'Last 30 days' }),
    last_60_days: t('dateLast60', { defaultValue: 'Last 60 days' }),
    last_90_days: t('dateLast90', { defaultValue: 'Last 90 days' }),
    this_quarter: t('dateThisQuarter', { defaultValue: 'This quarter' }),
    custom: t('dateCustom', { defaultValue: 'Custom' }),
  };
  const dateOptions = availableDatePresets.map(value => ({
    value,
    label: dateLabels[value],
  }));
  const selectedDateLabel =
    dateOptions.find(o => o.value === draftDatePreset)?.label ?? dateOptions[0]?.label;

  const panelContent = (
    <div
      role="group"
      aria-label={t('filtersTitle', { defaultValue: 'Filters' })}
      style={{ width: '100%' }}
    >
      <Flex gap={8} wrap="wrap" align="center">
        {showDate && (
          <SingleSelectFilterPill
            label={selectedDateLabel}
            options={dateOptions}
            value={draftDatePreset}
            onChange={value => setDraftDatePreset(value as AnalyticsDatePreset)}
            ariaLabel={t('datePreset', { defaultValue: 'Date range' })}
            isActive={draftDatePreset !== defaultDatePreset}
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
            label={statusFilterLabel ?? t('filterStatuses', { defaultValue: 'Statuses' })}
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
            size="small"
            value={draftIncludeDone ? 'include' : 'exclude'}
            onChange={val => setDraftIncludeDone(val === 'include')}
            style={FILTER_PILL_CONTROL_STYLE}
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

      <Flex align="center">
        <Flex gap={8} align="center">
          <Button
            disabled={!hasDraftFilters}
            onClick={handleClearAll}
            style={FILTER_PILL_BUTTON_STYLE}
          >
            {t('clearFilters', { defaultValue: 'Clear' })}
          </Button>
          <Button type="primary" onClick={handleApply} style={FILTER_PILL_BUTTON_STYLE}>
            {t('applyFilters', { defaultValue: 'Apply' })}
          </Button>
        </Flex>
      </Flex>
    </div>
  );

  return (
    <Flex
      vertical
      gap={12}
      align="flex-end"
      style={{
        width: '100%',
      }}
    >
      <Flex gap={8} align="center" style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button
          icon={<FilterOutlined />}
          onClick={() => {
            if (!panelOpen) {
              setDraftProjectIds(selectedProjectIds);
              setDraftMemberIds(selectedMemberIds);
              setDraftTeamIds(selectedTeamIds);
              setDraftDatePreset(datePreset ?? defaultDatePreset);
              setDraftStatusIds(selectedStatusIds);
              setDraftIncludeDone(includeDone ?? false);
            }
            setPanelOpen(!panelOpen);
          }}
          style={
            panelOpen || activeFilterCount > 0
              ? {
                  ...FILTER_TRIGGER_STYLE,
                  borderColor: token.colorPrimary,
                  color: token.colorPrimary,
                }
              : FILTER_TRIGGER_STYLE
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
        {panelOpen && filterContext?.actions}
      </Flex>
      {panelOpen && panelContent}
    </Flex>
  );
};
