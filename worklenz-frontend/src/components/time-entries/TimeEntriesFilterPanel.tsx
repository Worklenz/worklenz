import React from 'react';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Divider,
  Dropdown,
  Flex,
  List,
  Popover,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { CaretDownFilled, FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  FILTER_PILL_BUTTON_STYLE as PILL_BUTTON_STYLE,
  FilterOption,
  MultiSelectFilterPill,
} from '@/components/common/filters/MultiSelectFilterPill';
import { DateFilter } from './TimeEntriesFilters';

const { Text } = Typography;

interface DateFilterDropdownProps {
  value: DateFilter;
  onChange: (filter: DateFilter) => void;
  dateRange: [string, string] | null;
  onDateRangeChange: (range: [string, string] | null) => void;
}

const DateFilterDropdown: React.FC<DateFilterDropdownProps> = ({
  value,
  onChange,
  dateRange,
  onDateRangeChange,
}) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [open, setOpen] = React.useState(false);
  const [dateError, setDateError] = React.useState<string | null>(null);

  // Date filters operate on when time was logged, not the task due date.
  const dateOptions: { label: string; value: DateFilter }[] = [
    { label: t('filterToday', { defaultValue: 'Logged for Today' }), value: 'today' },
    { label: t('filterYesterday', { defaultValue: 'Yesterday' }), value: 'yesterday' },
    { label: t('filterThisWeek', { defaultValue: 'This Week' }), value: 'this_week' },
    { label: t('filterLastWeek', { defaultValue: 'Last Week' }), value: 'last_week' },
    { label: t('filterNoLoggedTime', { defaultValue: 'No Logged Time' }), value: 'no_logged_time' },
    { label: t('filterCustomRange', { defaultValue: 'Custom Range' }), value: 'custom' },
  ];

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null, dateStrings: [string, string]) => {
    if (dates && dates[0] && dates[1]) {
      if (dates[1].isBefore(dates[0], 'day')) {
        setDateError(t('dateRangeInvalidError', { defaultValue: 'End date must not be before start date.' }));
        onDateRangeChange(null);
        return;
      }
      setDateError(null);
      onDateRangeChange([dateStrings[0], dateStrings[1]]);
    } else {
      setDateError(null);
      onDateRangeChange(null);
    }
  };

  const selectedLabel = dateOptions.find(o => o.value === value)?.label ?? dateOptions[0].label;

  const dropdownContent = (
    <Card className="custom-card" style={{ width: 'min(240px, calc(100vw - 32px))' }} styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0 }}>
        {dateOptions.map(opt => {
          const selected = value === opt.value;
          return (
            <List.Item
              className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                if (opt.value !== 'custom') setOpen(false);
              }}
              style={{
                padding: '6px 8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: selected ? 500 : 400,
                color: selected ? token.colorPrimary : undefined,
              }}
            >
              {opt.label}
            </List.Item>
          );
        })}
      </List>
      {value === 'custom' && (
        <div style={{ padding: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Flex vertical gap={4}>
            <DatePicker.RangePicker
              value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={handleRangeChange}
              format="YYYY-MM-DD"
              allowClear
              order={false}
              size="small"
            />
            {dateError && <span style={{ color: '#ff4d4f', fontSize: 12 }}>{dateError}</span>}
          </Flex>
        </div>
      )}
    </Card>
  );

  return (
    <Dropdown overlayClassName="custom-dropdown" trigger={['click']} dropdownRender={() => dropdownContent} open={open} onOpenChange={setOpen}>
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        style={open ? { ...PILL_BUTTON_STYLE, borderColor: token.colorPrimary, color: token.colorPrimary } : PILL_BUTTON_STYLE}
      >
        {selectedLabel}
      </Button>
    </Dropdown>
  );
};

interface Project {
  id: string;
  name: string;
}

interface PersonOption {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface TimeEntriesFilterPanelProps {
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  dateRange: [string, string] | null;
  onDateRangeChange: (range: [string, string] | null) => void;
  projectIds: string[];
  onProjectIdsChange: (ids: string[]) => void;
  projects: Project[];
  /** Members filter only makes sense once the viewer can see more than their
   * own entries. Clients filter is always shown regardless of scope. */
  showPersonFilter: boolean;
  personOptions: PersonOption[];
  personIds: string[];
  onPersonIdsChange: (ids: string[]) => void;
  clientOptions: ClientOption[];
  clientIds: string[];
  onClientIdsChange: (ids: string[]) => void;
}

export const TimeEntriesFilterPanel: React.FC<TimeEntriesFilterPanelProps> = ({
  dateFilter,
  onDateFilterChange,
  dateRange,
  onDateRangeChange,
  projectIds,
  onProjectIdsChange,
  projects,
  showPersonFilter,
  personOptions,
  personIds,
  onPersonIdsChange,
  clientOptions,
  clientIds,
  onClientIdsChange,
}) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const [panelOpen, setPanelOpen] = React.useState(false);

  // Selections are staged locally and only pushed to the parent (which
  // triggers the actual table refetch) when Apply is clicked — checking a
  // few boxes shouldn't refire the query on every click.
  const [draftDateFilter, setDraftDateFilter] = React.useState(dateFilter);
  const [draftDateRange, setDraftDateRange] = React.useState(dateRange);
  const [draftProjectIds, setDraftProjectIds] = React.useState(projectIds);
  const [draftPersonIds, setDraftPersonIds] = React.useState(personIds);
  const [draftClientIds, setDraftClientIds] = React.useState(clientIds);

  // Re-sync the draft from the currently-applied values every time the panel
  // opens, so a discarded edit never lingers into the next open.
  React.useEffect(() => {
    if (!panelOpen) return;
    setDraftDateFilter(dateFilter);
    setDraftDateRange(dateRange);
    setDraftProjectIds(projectIds);
    setDraftPersonIds(personIds);
    setDraftClientIds(clientIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (dateFilter !== 'this_week') count++;
    if (projectIds.length > 0) count++;
    if (showPersonFilter && personIds.length > 0) count++;
    if (clientIds.length > 0) count++;
    return count;
  }, [dateFilter, projectIds, showPersonFilter, personIds, clientIds]);

  // Nothing to clear when the in-progress selection is already at defaults.
  const hasDraftFilters =
    draftDateFilter !== 'this_week' ||
    draftProjectIds.length > 0 ||
    (showPersonFilter && draftPersonIds.length > 0) ||
    draftClientIds.length > 0;

  const handleApply = () => {
    onDateFilterChange(draftDateFilter);
    onDateRangeChange(draftDateRange);
    onProjectIdsChange(draftProjectIds);
    if (showPersonFilter) onPersonIdsChange(draftPersonIds);
    onClientIdsChange(draftClientIds);
    setPanelOpen(false);
  };

  // Clear is an immediate action — it resets and applies in one click, unlike
  // individual selections which stay staged until Apply is pressed.
  const handleClearAll = () => {
    setDraftDateFilter('this_week');
    setDraftDateRange(null);
    setDraftProjectIds([]);
    setDraftPersonIds([]);
    setDraftClientIds([]);

    onDateFilterChange('this_week');
    onDateRangeChange(null);
    onProjectIdsChange([]);
    if (showPersonFilter) onPersonIdsChange([]);
    onClientIdsChange([]);
    setPanelOpen(false);
  };

  const clientFilterOptions: FilterOption[] = [
    { value: 'none', label: t('noClient', { defaultValue: 'No client' }) },
    ...clientOptions.map(c => ({ value: c.id, label: c.name })),
  ];

  const searchPlaceholder = t('searchFilterPlaceholder', { defaultValue: 'Search...' });

  const panelContent = (
    <div style={{ width: 'min(420px, calc(100vw - 32px))', padding: '4px 0' }}>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
        {t('filtersTitle', { defaultValue: 'Filters' })}
      </Text>

      <Flex gap={8} wrap="wrap" align="center">
        <DateFilterDropdown
          value={draftDateFilter}
          onChange={setDraftDateFilter}
          dateRange={draftDateRange}
          onDateRangeChange={setDraftDateRange}
        />
        <MultiSelectFilterPill
          searchPlaceholder={searchPlaceholder}
          label={t('filterProject', { defaultValue: 'Project' })}
          options={projects.map(p => ({ value: p.id, label: p.name }))}
          value={draftProjectIds}
          onChange={setDraftProjectIds}
        />
        {showPersonFilter && (
          <MultiSelectFilterPill
            searchPlaceholder={searchPlaceholder}
            label={t('filterPerson', { defaultValue: 'Members' })}
            options={personOptions.map(p => ({ value: p.id, label: p.name }))}
            value={draftPersonIds}
            onChange={setDraftPersonIds}
          />
        )}
        <MultiSelectFilterPill
          searchPlaceholder={searchPlaceholder}
          label={t('filterClient', { defaultValue: 'Clients' })}
          options={clientFilterOptions}
          value={draftClientIds}
          onChange={setDraftClientIds}
          searchable={clientOptions.length > 8}
        />
      </Flex>

      <Divider style={{ margin: '12px 0' }} />

      <Flex justify="space-between" align="center">
        <Button size="small" disabled={!hasDraftFilters} onClick={handleClearAll} style={{ borderRadius: 7 }}>
          {t('clearAll', { defaultValue: 'Clear' })}
        </Button>
        <Button type="primary" size="small" onClick={handleApply} style={{ borderRadius: 7 }}>
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
      overlayStyle={{ padding: 0 }}
      overlayInnerStyle={{ padding: '12px 16px', borderRadius: 8 }}
    >
      <Button
        icon={<FilterOutlined />}
        style={
          panelOpen || activeFilterCount > 0
            ? { ...PILL_BUTTON_STYLE, borderColor: token.colorPrimary, color: token.colorPrimary }
            : PILL_BUTTON_STYLE
        }
      >
        {t('filterButton', { defaultValue: 'Filter' })}
        {activeFilterCount > 0 && (
          <Badge count={activeFilterCount} size="small" style={{ marginLeft: 4, backgroundColor: token.colorPrimary }} />
        )}
      </Button>
    </Popover>
  );
};
