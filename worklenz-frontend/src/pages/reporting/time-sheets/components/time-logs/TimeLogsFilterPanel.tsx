import React from 'react';
import { Badge, Button, Divider, Flex, Popover, Typography, theme } from '@/shared/antd-imports';
import { FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  FILTER_PILL_BUTTON_STYLE,
  FilterOption,
  MultiSelectFilterPill,
} from '@/components/common/filters/MultiSelectFilterPill';
import { TimeLogsDatePresetPill } from './TimeLogsDatePresetPill';
import {
  DEFAULT_TIME_LOGS_FILTERS,
  ITimeLogsFilterState,
  TimeLogsBillableValue,
  countActiveFilters,
  isApplicable,
  normalizeFilters,
  areFiltersEqual,
} from './time-logs-filters';

const { Text } = Typography;

export interface ITimeLogsFilterOptions {
  options: FilterOption[];
  loading: boolean;
  failed: boolean;
}

interface TimeLogsFilterPanelProps {
  filters: ITimeLogsFilterState;
  onApply: (next: ITimeLogsFilterState) => void;
  projects: ITimeLogsFilterOptions;
  practices: ITimeLogsFilterOptions;
  clients: ITimeLogsFilterOptions;
  members: ITimeLogsFilterOptions;
}

export const TimeLogsFilterPanel: React.FC<TimeLogsFilterPanelProps> = ({
  filters,
  onApply,
  projects,
  practices,
  clients,
  members,
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();
  const [panelOpen, setPanelOpen] = React.useState(false);

  // Selections are staged here and only pushed to the page (which refetches)
  // when Apply is clicked — ticking a few boxes shouldn't refire the query on
  // every click.
  const [draft, setDraft] = React.useState<ITimeLogsFilterState>(filters);

  // Re-sync the draft from the applied values every time the panel opens, so
  // a discarded edit never lingers into the next open.
  const handleOpenChange = (open: boolean) => {
    if (open) setDraft(filters);
    setPanelOpen(open);
  };

  const activeCount = React.useMemo(() => countActiveFilters(filters), [filters]);
  const hasDraftFilters = !areFiltersEqual(draft, DEFAULT_TIME_LOGS_FILTERS);
  const canApply = isApplicable(draft);

  const patch = (changes: Partial<ITimeLogsFilterState>) =>
    setDraft(prev => ({ ...prev, ...changes }));

  const handleApply = () => {
    if (!canApply) return;
    onApply(normalizeFilters(draft));
    setPanelOpen(false);
  };

  // Clear is immediate — it resets and applies in one click, unlike individual
  // selections which stay staged until Apply is pressed.
  const handleClear = () => {
    setDraft(DEFAULT_TIME_LOGS_FILTERS);
    onApply(DEFAULT_TIME_LOGS_FILTERS);
    setPanelOpen(false);
  };

  const searchPlaceholder = t('timeLogsSearchOptions', { defaultValue: 'Search...' });
  const noOptionsText = t('timeLogsNoOptions', { defaultValue: 'No options found' });
  const errorText = t('timeLogsOptionsError', { defaultValue: 'Could not load the options' });

  const billableOptions: FilterOption[] = [
    { value: 'billable', label: t('billable', { defaultValue: 'Billable' }) },
    { value: 'non_billable', label: t('Non-billable', { defaultValue: 'Non-billable' }) },
  ];

  // The four pills backed by a loaded list of options share everything but their label and field.
  const optionsPill = (
    label: string,
    group: ITimeLogsFilterOptions,
    selected: string[],
    onChange: (next: string[]) => void
  ) => (
    <MultiSelectFilterPill
      label={label}
      searchPlaceholder={searchPlaceholder}
      emptyText={group.failed ? errorText : noOptionsText}
      loading={group.loading}
      options={group.options}
      value={selected}
      onChange={onChange}
    />
  );

  const panelContent = (
    // 64px = the popover's own 16px side padding (x2) plus a 16px gutter each side of the screen.
    <div style={{ width: 'min(460px, calc(100vw - 64px))', padding: '4px 0' }}>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
        {t('timeLogsFiltersTitle', { defaultValue: 'Filters' })}
      </Text>

      <Flex gap={8} wrap="wrap" align="center">
        <TimeLogsDatePresetPill
          datePreset={draft.datePreset}
          customRange={draft.customRange}
          onChange={(datePreset, customRange) => patch({ datePreset, customRange })}
        />
        {optionsPill(
          t('timeLogsClient', { defaultValue: 'Client' }),
          clients,
          draft.clientIds,
          clientIds => patch({ clientIds })
        )}
        {optionsPill(
          t('timeLogsFilterProject', { defaultValue: 'Project' }),
          projects,
          draft.projectIds,
          projectIds => patch({ projectIds })
        )}
        {optionsPill(
          t('timeLogsFilterPractice', { defaultValue: 'Practice' }),
          practices,
          draft.practiceIds,
          practiceIds => patch({ practiceIds })
        )}
        {optionsPill(
          t('timeLogsFilterMembers', { defaultValue: 'Members' }),
          members,
          draft.userIds,
          userIds => patch({ userIds })
        )}
        <MultiSelectFilterPill
          label={t('timeLogsFilterBillable', { defaultValue: 'Billable' })}
          searchable={false}
          options={billableOptions}
          value={draft.billable}
          onChange={values => patch({ billable: values as TimeLogsBillableValue[] })}
        />
      </Flex>

      <Divider style={{ margin: '12px 0' }} />

      <Flex justify="space-between" align="center" gap={8}>
        <Button
          size="small"
          disabled={!hasDraftFilters}
          onClick={handleClear}
          style={{ borderRadius: 7 }}
        >
          {t('timeLogsFilterClear', { defaultValue: 'Clear' })}
        </Button>
        <Flex align="center" gap={8}>
          {!canApply && (
            <Text type="secondary" style={{ fontSize: 12 }} role="status">
              {t('timeLogsCustomRangeRequired', {
                defaultValue: 'Pick a start and end date to apply a custom range.',
              })}
            </Text>
          )}
          <Button
            type="primary"
            size="small"
            disabled={!canApply}
            onClick={handleApply}
            style={{ borderRadius: 7 }}
          >
            {t('timeLogsFilterApply', { defaultValue: 'Apply' })}
          </Button>
        </Flex>
      </Flex>
    </div>
  );

  return (
    <Popover
      content={panelContent}
      trigger="click"
      placement="bottomLeft"
      open={panelOpen}
      onOpenChange={handleOpenChange}
      styles={{ root: { padding: 0 }, body: { padding: '12px 16px', borderRadius: 8 } }}
    >
      <Button
        icon={<FilterOutlined />}
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        style={
          panelOpen || activeCount > 0
            ? {
                ...FILTER_PILL_BUTTON_STYLE,
                borderColor: token.colorPrimary,
                color: token.colorPrimary,
              }
            : FILTER_PILL_BUTTON_STYLE
        }
      >
        {t('timeLogsFilterButton', { defaultValue: 'Filter' })}
        {activeCount > 0 && (
          <Badge
            count={activeCount}
            size="small"
            style={{ marginLeft: 4, backgroundColor: token.colorPrimary }}
          />
        )}
      </Button>
    </Popover>
  );
};
