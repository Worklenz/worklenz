import React from 'react';
import {
  Badge,
  Button,
  Divider,
  Flex,
  Popover,
  Segmented,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  FILTER_PILL_BUTTON_STYLE,
  FILTER_PILL_CONTROL_STYLE,
  MultiSelectFilterPill,
  type FilterOption,
} from '@/components/common/filters/MultiSelectFilterPill';
import { ReportingDatePresetPill } from '@/components/reporting/filters/ReportingDatePresetPill';
import {
  isReportingDateApplicable,
  type ReportingCustomRange,
  type ReportingDatePreset,
} from '@/utils/date-presets';

const { Text } = Typography;

/** Same presets as Classic Time Logs / reporting date filters. */
export type AnalyticsDatePreset = ReportingDatePreset;

const areSameIdSets = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => sortedB[i] === id);
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
   * Team IDs restored on Clear (and treated as non-active for the badge).
   * Analytics pages that scope projects by team should pass the session/default team
   * so Clear does not empty the Projects dropdown.
   */
  defaultTeamIds?: string[];
  datePreset?: AnalyticsDatePreset;
  customRange?: ReportingCustomRange;
  /** Applies both the preset and optional custom range together (staged until Apply). */
  onDateChange?: (preset: AnalyticsDatePreset, customRange: ReportingCustomRange) => void;
  /**
   * @deprecated Prefer `onDateChange`. Still accepted so callers that only need a preset
   * keep compiling during migration; custom range is passed as null.
   */
  onDatePresetChange?: (preset: AnalyticsDatePreset) => void;
  /** Limit which date presets appear (defaults to the Classic reporting list). */
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
  defaultTeamIds = [],
  datePreset,
  customRange = null,
  onDateChange,
  onDatePresetChange,
  availableDatePresets,
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
  const applyDate = onDateChange ?? (onDatePresetChange
    ? (preset: AnalyticsDatePreset) => onDatePresetChange(preset)
    : undefined);
  const showDate = Boolean(datePreset && applyDate);
  const showStatuses = Boolean(onStatusesChange && statusOptions.length > 0);
  const showIncludeDone =
    typeof includeDone === 'boolean' && Boolean(onIncludeDoneChange);

  const isDefaultTeamSelection = React.useCallback(
    (ids: string[]) => areSameIdSets(ids, defaultTeamIds),
    [defaultTeamIds]
  );

  const [draftProjectIds, setDraftProjectIds] = React.useState(selectedProjectIds);
  const [draftMemberIds, setDraftMemberIds] = React.useState(selectedMemberIds);
  const [draftTeamIds, setDraftTeamIds] = React.useState(selectedTeamIds);
  const [draftDatePreset, setDraftDatePreset] = React.useState(
    datePreset ?? defaultDatePreset
  );
  const [draftCustomRange, setDraftCustomRange] = React.useState<ReportingCustomRange>(customRange);
  const [draftStatusIds, setDraftStatusIds] = React.useState(selectedStatusIds);
  const [draftIncludeDone, setDraftIncludeDone] = React.useState(includeDone ?? false);

  React.useEffect(() => {
    if (!panelOpen) return;
    setDraftProjectIds(selectedProjectIds);
    setDraftMemberIds(selectedMemberIds);
    setDraftTeamIds(selectedTeamIds);
    setDraftDatePreset(datePreset ?? defaultDatePreset);
    setDraftCustomRange(customRange);
    setDraftStatusIds(selectedStatusIds);
    setDraftIncludeDone(includeDone ?? false);
    // Re-sync drafts only when the panel opens (same pattern as Time Entries).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedProjectIds.length > 0) count++;
    if (showMembers && selectedMemberIds.length > 0) count++;
    if (showTeams && !isDefaultTeamSelection(selectedTeamIds)) {
      count++;
    }
    if (
      showDate &&
      datePreset &&
      (datePreset !== defaultDatePreset || (datePreset === 'custom' && customRange))
    ) {
      count++;
    }
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
    customRange,
    defaultDatePreset,
    showStatuses,
    selectedStatusIds,
    showIncludeDone,
    includeDone,
  ]);

  const hasDraftFilters =
    draftProjectIds.length > 0 ||
    (showMembers && draftMemberIds.length > 0) ||
    (showTeams && !isDefaultTeamSelection(draftTeamIds)) ||
    (showDate &&
      (draftDatePreset !== defaultDatePreset ||
        (draftDatePreset === 'custom' && draftCustomRange !== null))) ||
    (showStatuses && draftStatusIds.length > 0) ||
    (showIncludeDone && draftIncludeDone);

  const isDateDraftApplicable =
    !showDate || isReportingDateApplicable(draftDatePreset, draftCustomRange);

  const emitDate = (preset: AnalyticsDatePreset, range: ReportingCustomRange) => {
    if (onDateChange) {
      onDateChange(preset, range);
    } else if (onDatePresetChange) {
      onDatePresetChange(preset);
    }
  };

  const handleApply = () => {
    if (!isDateDraftApplicable) return;
    onProjectsChange(draftProjectIds);
    if (onMembersChange) onMembersChange(draftMemberIds);
    if (onTeamsChange) onTeamsChange(draftTeamIds);
    if (showDate) emitDate(draftDatePreset, draftCustomRange);
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
    setDraftCustomRange(null);
    setDraftStatusIds([]);
    setDraftIncludeDone(false);

    onProjectsChange([]);
    if (onMembersChange) onMembersChange([]);
    if (onTeamsChange) onTeamsChange(resetTeamIds);
    if (showDate) emitDate(defaultDatePreset, null);
    if (onStatusesChange) onStatusesChange([]);
    if (onIncludeDoneChange) onIncludeDoneChange(false);
    setPanelOpen(false);
  };

  const panelContent = (
    <div style={{ width: 'min(420px, calc(100vw - 32px))', padding: '4px 0' }}>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
        {t('filtersTitle', { defaultValue: 'Filters' })}
      </Text>

      <Flex gap={8} wrap="wrap" align="center">
        {showDate && (
          <ReportingDatePresetPill
            datePreset={draftDatePreset}
            customRange={draftCustomRange}
            allowedPresets={availableDatePresets}
            showResolvedRange
            onChange={(preset, range) => {
              setDraftDatePreset(preset);
              setDraftCustomRange(range);
            }}
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

      <Flex justify="space-between" align="center">
        <Button
          disabled={!hasDraftFilters}
          onClick={handleClearAll}
          style={FILTER_PILL_BUTTON_STYLE}
        >
          {t('clearFilters', { defaultValue: 'Clear' })}
        </Button>
        <Button
          type="primary"
          onClick={handleApply}
          disabled={!isDateDraftApplicable}
          style={FILTER_PILL_BUTTON_STYLE}
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
