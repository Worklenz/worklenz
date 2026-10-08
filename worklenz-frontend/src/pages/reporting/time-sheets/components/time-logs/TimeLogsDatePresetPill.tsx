import React from 'react';
import { Button, Card, DatePicker, Dropdown, Flex, List, theme } from '@/shared/antd-imports';
import { CaretDownFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useAppSelector } from '@/hooks/useAppSelector';
import { FILTER_PILL_BUTTON_STYLE } from '@/components/common/filters/MultiSelectFilterPill';
import { DATE_PRESET_FORMAT } from '@/utils/date-presets';
import {
  ITimeLogsFilterState,
  TIME_LOGS_DATE_PRESETS,
  TimeLogsDatePreset,
} from './time-logs-filters';

interface TimeLogsDatePresetPillProps {
  datePreset: TimeLogsDatePreset;
  customRange: ITimeLogsFilterState['customRange'];
  onChange: (
    datePreset: TimeLogsDatePreset,
    customRange: ITimeLogsFilterState['customRange']
  ) => void;
  /** When provided, only these presets are shown in the dropdown. Defaults to TIME_LOGS_DATE_PRESETS. */
  allowedPresets?: TimeLogsDatePreset[];
}

/** Default text per preset, keyed to the `time-report` locale keys. */
export const PRESET_LABELS: Record<TimeLogsDatePreset, { key: string; defaultValue: string }> = {
  today: { key: 'timeLogsPresetToday', defaultValue: 'Today' },
  yesterday: { key: 'timeLogsPresetYesterday', defaultValue: 'Yesterday' },
  last_7_days: { key: 'timeLogsPresetLast7Days', defaultValue: 'Last 7 Days' },
  this_week: { key: 'timeLogsPresetThisWeek', defaultValue: 'This Week' },
  last_week: { key: 'timeLogsPresetLastWeek', defaultValue: 'Last Week' },
  this_month: { key: 'timeLogsPresetThisMonth', defaultValue: 'This Month' },
  last_30_days: { key: 'timeLogsPresetLast30Days', defaultValue: 'Last 30 Days' },
  last_month: { key: 'timeLogsPresetLastMonth', defaultValue: 'Last Month' },
  last_3_months: { key: 'timeLogsPresetLast3Months', defaultValue: 'Last 3 Months' },
  last_90_days: { key: 'timeLogsPresetLast90Days', defaultValue: 'Last 90 Days' },
  all_time: { key: 'timeLogsPresetAllTime', defaultValue: 'All Time' },
  custom: { key: 'timeLogsPresetCustom', defaultValue: 'Custom Range' },
};

export const TimeLogsDatePresetPill: React.FC<TimeLogsDatePresetPillProps> = ({
  datePreset,
  customRange,
  onChange,
  allowedPresets,
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [open, setOpen] = React.useState(false);
  const [dateError, setDateError] = React.useState<string | null>(null);

  const presetsToShow = allowedPresets ?? TIME_LOGS_DATE_PRESETS;

  const labelOf = (preset: TimeLogsDatePreset) =>
    t(PRESET_LABELS[preset].key, { defaultValue: PRESET_LABELS[preset].defaultValue });

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      if (dates[1].isBefore(dates[0], 'day')) {
        setDateError(
          t('timeLogsDateRangeInvalid', {
            defaultValue: 'End date must not be before start date.',
          })
        );
        onChange('custom', null);
        return;
      }
      setDateError(null);
      onChange('custom', [
        dates[0].format(DATE_PRESET_FORMAT),
        dates[1].format(DATE_PRESET_FORMAT),
      ]);
    } else {
      setDateError(null);
      onChange('custom', null);
    }
  };

  // Picking a preset applies it to the draft; a custom range stays open for its date inputs.
  const choose = (preset: TimeLogsDatePreset) => {
    onChange(preset, preset === 'custom' ? customRange : null);
    if (preset !== 'custom') setOpen(false);
  };

  const dropdownContent = (
    <Card
      className="custom-card"
      style={{ width: 'min(160px, calc(100vw - 32px))' }}
      styles={{ body: { padding: 0 } }}
    >
      <div role="listbox" aria-label={t('timeLogsFiltersTitle', { defaultValue: 'Filters' })}>
        <List style={{ padding: 0 }}>
          {presetsToShow.map(preset => {
            const selected = datePreset === preset;
            return (
              <List.Item
                className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                key={preset}
                role="option"
                aria-selected={selected}
                tabIndex={0}
                onClick={() => choose(preset)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose(preset);
                  }
                }}
                style={{
                  padding: '6px 8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: selected ? 500 : 400,
                  color: selected ? token.colorPrimary : undefined,
                }}
              >
                <span>{labelOf(preset)}</span>
              </List.Item>
            );
          })}
        </List>
      </div>
      {datePreset === 'custom' && (
        <div style={{ padding: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Flex vertical gap={4}>
            <DatePicker.RangePicker
              value={customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null}
              onChange={handleRangeChange}
              format="YYYY-MM-DD"
              allowClear
              order={false}
              size="small"
              style={{ width: '100%' }}
            />
            {dateError && (
              <span style={{ color: token.colorError, fontSize: 12 }}>{dateError}</span>
            )}
          </Flex>
        </div>
      )}
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      popupRender={() => dropdownContent}
      open={open}
      onOpenChange={setOpen}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        style={
          open
            ? {
                ...FILTER_PILL_BUTTON_STYLE,
                borderColor: token.colorPrimary,
                color: token.colorPrimary,
              }
            : FILTER_PILL_BUTTON_STYLE
        }
      >
        {labelOf(datePreset)}
      </Button>
    </Dropdown>
  );
};
