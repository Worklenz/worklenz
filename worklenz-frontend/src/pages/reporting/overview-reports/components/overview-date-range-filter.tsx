import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Dropdown,
  Flex,
  Space,
  Typography,
  CalendarOutlined,
  DownOutlined,
  CheckOutlined,
} from '@/shared/antd-imports';
import { DatePresetKey, formatCalendarDate, getDatePresetRange } from '@/utils/date-presets';

export type OverviewDateRangeKey = DatePresetKey | 'custom';

export interface OverviewDateRangeValue {
  preset: OverviewDateRangeKey;
  /** Resolved inclusive range, or `null` for `all_time` (no bound at all). */
  range: { from: string; to: string } | null;
}

export const DEFAULT_OVERVIEW_DATE_RANGE: OverviewDateRangeValue = { preset: 'all_time', range: null };

const PRESETS: { key: DatePresetKey; labelKey: string; defaultLabel: string }[] = [
  { key: 'today', labelKey: 'dateRangeFilter.today', defaultLabel: 'Today' },
  { key: 'yesterday', labelKey: 'dateRangeFilter.yesterday', defaultLabel: 'Yesterday' },
  { key: 'this_week', labelKey: 'dateRangeFilter.thisWeek', defaultLabel: 'This week' },
  { key: 'last_week', labelKey: 'dateRangeFilter.lastWeek', defaultLabel: 'Last week' },
  { key: 'this_month', labelKey: 'dateRangeFilter.thisMonth', defaultLabel: 'This month' },
  { key: 'last_month', labelKey: 'dateRangeFilter.lastMonth', defaultLabel: 'Last month' },
  { key: 'last_3_months', labelKey: 'dateRangeFilter.last3Months', defaultLabel: 'Last 3 months' },
  { key: 'all_time', labelKey: 'dateRangeFilter.allTime', defaultLabel: 'All time' },
];

export interface OverviewDateRangeFilterProps {
  value: OverviewDateRangeValue;
  onChange: (value: OverviewDateRangeValue) => void;
}

/**
 * Page-level date range filter shown next to the "Customize" button. Presets resolve through the
 * shared {@link getDatePresetRange} helper (same source as the other reporting date filters), plus
 * a custom range. `all_time` is the default and is not treated as "active" for the button's styling.
 */
export const OverviewDateRangeFilter: React.FC<OverviewDateRangeFilterProps> = ({ value, onChange }) => {
  const { t } = useTranslation('reporting-overview');
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs] | null>(
    value.preset === 'custom' && value.range ? [dayjs(value.range.from), dayjs(value.range.to)] : null
  );

  const label = useMemo(() => {
    if (value.preset === 'custom' && value.range) {
      return `${formatCalendarDate(value.range.from)} - ${formatCalendarDate(value.range.to)}`;
    }
    const preset = PRESETS.find(item => item.key === value.preset);
    return preset ? t(preset.labelKey, { defaultValue: preset.defaultLabel }) : t('dateRangeFilter.allTime', { defaultValue: 'All time' });
  }, [value, t]);

  const selectPreset = (preset: DatePresetKey) => {
    setDraftRange(null);
    onChange({ preset, range: getDatePresetRange(preset) });
    setOpen(false);
  };

  const applyCustomRange = () => {
    if (!draftRange) return;
    onChange({
      preset: 'custom',
      range: { from: draftRange[0].format('YYYY-MM-DD'), to: draftRange[1].format('YYYY-MM-DD') },
    });
    setOpen(false);
  };

  const dropdownContent = (
    <Card styles={{ body: { padding: '8px 0', minWidth: 260 } }} style={{ borderRadius: 8 }}>
      <Flex vertical>
        {PRESETS.map(item => {
          const selected = value.preset === item.key;
          return (
            <Button
              key={item.key}
              type="text"
              onClick={() => selectPreset(item.key)}
              style={{ justifyContent: 'flex-start', fontWeight: selected ? 500 : 400 }}
            >
              <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                <Typography.Text style={{ color: selected ? 'inherit' : undefined }}>
                  {t(item.labelKey, { defaultValue: item.defaultLabel })}
                </Typography.Text>
                {selected && <CheckOutlined />}
              </Flex>
            </Button>
          );
        })}
      </Flex>
      <Divider style={{ margin: '8px 0' }} />
      <Flex vertical gap={8} style={{ padding: '0 12px 12px' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('dateRangeFilter.customRange', { defaultValue: 'Custom range' })}
        </Typography.Text>
        <DatePicker.RangePicker
          size="middle"
          style={{ width: '100%' }}
          value={draftRange}
          onChange={dates => setDraftRange(dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null)}
        />
        <Button type="primary" size="small" disabled={!draftRange} onClick={applyCustomRange}>
          {t('dateRangeFilter.apply', { defaultValue: 'Apply' })}
        </Button>
      </Flex>
    </Card>
  );

  return (
    <Dropdown trigger={['click']} open={open} onOpenChange={setOpen} dropdownRender={() => dropdownContent}>
      <Button icon={<CalendarOutlined />} type="primary">
        <Space size={6}>
          {label}
          <DownOutlined style={{ fontSize: 10 }} />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default OverviewDateRangeFilter;
