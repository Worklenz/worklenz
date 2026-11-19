import React from 'react';
import { Button, Card, DatePicker, Dropdown, Flex, List, theme } from '@/shared/antd-imports';
import { CaretDownFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useAppSelector } from '@/hooks/useAppSelector';
import { FILTER_PILL_BUTTON_STYLE } from '@/components/common/filters/MultiSelectFilterPill';
import {
  DATE_PRESET_FORMAT,
  REPORTING_DATE_PRESET_LABELS,
  REPORTING_DATE_PRESETS,
  formatResolvedRange,
  resolveReportingDateRange,
  type ReportingCustomRange,
  type ReportingDatePreset,
} from '@/utils/date-presets';

export interface ReportingDatePresetPillProps {
  datePreset: ReportingDatePreset;
  customRange: ReportingCustomRange;
  onChange: (datePreset: ReportingDatePreset, customRange: ReportingCustomRange) => void;
  /** When provided, only these presets are shown in the dropdown. Defaults to REPORTING_DATE_PRESETS. */
  allowedPresets?: ReportingDatePreset[];
  /** Whether to show the resolved date range next to the preset label (e.g. "Sep 1 – Sep 17"). Defaults to true unless allowedPresets is provided. */
  showResolvedRange?: boolean;
}

/** @deprecated Prefer REPORTING_DATE_PRESET_LABELS from `@/utils/date-presets`. */
export const PRESET_LABELS = REPORTING_DATE_PRESET_LABELS;

export const ReportingDatePresetPill: React.FC<ReportingDatePresetPillProps> = ({
  datePreset,
  customRange,
  onChange,
  allowedPresets,
  showResolvedRange,
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [open, setOpen] = React.useState(false);
  const [dateError, setDateError] = React.useState<string | null>(null);

  const presetsToShow = allowedPresets ?? REPORTING_DATE_PRESETS;
  const shouldShowRange = showResolvedRange ?? !allowedPresets;

  const labelOf = (preset: ReportingDatePreset) =>
    t(REPORTING_DATE_PRESET_LABELS[preset].key, {
      defaultValue: REPORTING_DATE_PRESET_LABELS[preset].defaultValue,
    });

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
  const choose = (preset: ReportingDatePreset) => {
    onChange(preset, preset === 'custom' ? customRange : null);
    if (preset !== 'custom') setOpen(false);
  };

  // Compact presets are used when showResolvedRange is false, but full width is kept when showing date ranges or the custom range picker.
  const dropdownWidth =
    datePreset === 'custom' || shouldShowRange
      ? 'min(300px, calc(100vw - 32px))'
      : 'min(160px, calc(100vw - 32px))';

  const dropdownContent = (
    <Card
      className="custom-card"
      style={{ width: dropdownWidth }}
      styles={{ body: { padding: 0 } }}
    >
      <div role="listbox" aria-label={t('timeLogsFiltersTitle', { defaultValue: 'Filters' })}>
        <List style={{ padding: 0 }}>
          {presetsToShow.map(preset => {
            const selected = datePreset === preset;
            const rangeText =
              !shouldShowRange || preset === 'custom'
                ? null
                : formatResolvedRange(
                    resolveReportingDateRange({ datePreset: preset, customRange: null })
                  );

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
                <Flex justify="space-between" align="baseline" gap={12} style={{ width: '100%' }}>
                  <span>{labelOf(preset)}</span>
                  {rangeText && (
                    <span
                      style={{
                        fontSize: 11,
                        color: token.colorTextSecondary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rangeText}
                    </span>
                  )}
                </Flex>
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
