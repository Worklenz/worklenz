import { DownOutlined, CalendarOutlined, CheckOutlined } from '@/shared/antd-imports';
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Dropdown,
  Flex,
  List,
  Typography,
  Space,
} from '@/shared/antd-imports';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import { colors } from '@/styles/colors';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { durations } from '@/shared/constants';
import { setDateRange, setDuration } from '@/features/reporting/reporting.slice';

const TimeWiseFilter = () => {
  const { t } = useTranslation('reporting-members');
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);
  const dispatch = useAppDispatch();

  // Get values from Redux store
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<string>(
    durations.find(item => item.key === duration)?.label || 'lastSevenDaysText'
  );
  // const [customRange, setCustomRange] = useState<[string, string] | null>(
  //   dateRange.length === 2 ? [dateRange[0], dateRange[1]] : null
  // );
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  // Format customRange for display
  const getDisplayLabel = () => {
    const f = 'YY-MM-DD';
    if (customRange && customRange.length === 2) {
      return `${dayjs(customRange[0]).format(f)} - ${dayjs(customRange[1]).format(f)}`;
    }
    return t(selectedTimeFrame);
  };

  // Apply changes when date range is selected
  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      if (dates[1].isBefore(dates[0], 'day')) {
        setDateError(
          t('customDateRangeInvalidError', {
            defaultValue: 'End date cannot be before the start date. Please select a valid range.',
          })
        );
        setCustomRange(null);
        return;
      }
      setDateError(null);
      setSelectedTimeFrame('');
      setCustomRange([dates[0].toDate().toString(), dates[1].toDate().toString()]);
    } else {
      if (!dates || !dates[0]) {
        setDateError(null);
        setCustomRange(null);
      }
    }
  };

  // Apply custom date filter
  const applyCustomDateFilter = () => {
    if (customRange) {
      setSelectedTimeFrame('customRange');
      setIsDropdownOpen(false);
      dispatch(setDateRange([customRange[0], customRange[1]]));
    }
  };

  // Handle duration item selection
  const handleDurationSelect = (item: any) => {
    setSelectedTimeFrame(item.label);
    setCustomRange(null);
    dispatch(setDuration(item.key));
    if (item.key === 'YESTERDAY') {
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      dispatch(setDateRange([yesterday, yesterday]));
    } else if (item.dates) {
      const [startDate, endDate] = item.dates.split(' - ');
      dispatch(setDateRange([startDate, endDate]));
    } else {
      // For ALL_TIME or any other case without specific dates, use a default range
      const defaultStartDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');
      const defaultEndDate = dayjs().format('YYYY-MM-DD');
      dispatch(setDateRange([defaultStartDate, defaultEndDate]));
    }
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    const selectedDuration = durations.find(item => item.key === duration);
    if (selectedDuration?.dates) {
      if (duration === 'YESTERDAY') {
        const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
        dispatch(setDateRange([yesterday, yesterday]));
      } else {
        const [startDate, endDate] = selectedDuration.dates.split(' - ');
        dispatch(setDateRange([startDate, endDate]));
      }
    } else {
      // For ALL_TIME or any other case without specific dates, use a default range
      const defaultStartDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');
      const defaultEndDate = dayjs().format('YYYY-MM-DD');
      dispatch(setDateRange([defaultStartDate, defaultEndDate]));
    }
  }, [duration]);

  // custom dropdown content
  const renderDropdownContent = () => (
    <Card
      className="custom-card"
      styles={{
        body: {
          padding: '8px 0',
          minWidth: 340,
          maxHeight: 400,
          overflowY: 'auto',
        },
      }}
      style={{
        borderRadius: 8,
        boxShadow:
          '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div style={{ padding: '0 4px' }}>
        <Typography.Text
          type="secondary"
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '8px 12px 4px',
            display: 'block',
          }}
        >
          {t('quickRanges', { defaultValue: 'Quick Ranges' })}
        </Typography.Text>

        {durations.map(item => (
          <div
            key={item.key}
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 12px',
              margin: '2px 4px',
              backgroundColor:
                selectedTimeFrame === item.label && themeMode === 'dark'
                  ? '#434343'
                  : selectedTimeFrame === item.label && themeMode === 'light'
                    ? '#e6f4ff'
                    : 'transparent',
              borderRadius: 6,
              border:
                selectedTimeFrame === item.label
                  ? `1px solid ${colors.skyBlue}`
                  : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (selectedTimeFrame !== item.label) {
                e.currentTarget.style.backgroundColor =
                  themeMode === 'dark' ? '#2a2a2a' : '#f5f5f5';
              }
            }}
            onMouseLeave={e => {
              if (selectedTimeFrame !== item.label) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            onClick={() => handleDurationSelect(item)}
          >
            <Space size={8}>
              <CalendarOutlined
                style={{
                  color: selectedTimeFrame === item.label ? colors.skyBlue : '#8c8c8c',
                  fontSize: 14,
                }}
              />
              <Typography.Text
                style={{
                  color: selectedTimeFrame === item.label ? colors.skyBlue : 'inherit',
                  fontWeight: selectedTimeFrame === item.label ? 500 : 400,
                }}
              >
                {t(item.label)}
              </Typography.Text>
            </Space>

            <Flex align="center" gap={8}>
              {selectedTimeFrame === item.label && (
                <CheckOutlined style={{ color: colors.skyBlue, fontSize: 12 }} />
              )}
              <Typography.Text
                type="secondary"
                style={{
                  fontSize: 11,
                  textAlign: 'right',
                  lineHeight: '14px',
                }}
              >
                {item.dates ? (
                  <>
                    {dayjs(item.dates.split(' - ')[0]).format('MMM DD')}
                    <br />
                    {item.dates.includes(' - ') &&
                      dayjs(item.dates.split(' - ')[1]).format('MMM DD, YYYY')}
                  </>
                ) : (
                  ''
                )}
              </Typography.Text>
            </Flex>
          </div>
        ))}
      </div>

      <Divider style={{ margin: '12px 8px' }} />

      <div style={{ padding: '8px 16px 16px' }}>
        <Typography.Text
          type="secondary"
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 12,
            display: 'block',
          }}
        >
          {t('customRangeText')}
        </Typography.Text>

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <DatePicker.RangePicker
            format={'MMM DD, YYYY'}
            onChange={handleDateRangeChange}
            value={customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null}
            style={{ width: '100%' }}
            size="middle"
            placeholder={[t('startDateInputPlaceholder', { defaultValue: 'Start date' }), t('EndDateInputPlaceholder', { defaultValue: 'End date' })]}
            disabledDate={(current, { from }) => {
              if (from) {
                return current.isBefore(from, 'day');
              }
              return false;
            }}
          />
          {dateError && (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              {dateError}
            </Typography.Text>
          )}

          <Flex justify="space-between" align="center">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t(customRange ? 'readyToApplyCustomRange' : 'selectStartEndDates', {
                defaultValue: customRange ? 'Ready to apply custom range' : 'Select start and end dates',
              })}
            </Typography.Text>
            <Button
              type="primary"
              size="small"
              onClick={applyCustomDateFilter}
              disabled={!customRange}
              style={{
                borderRadius: 6,
                fontWeight: 500,
              }}
            >
              {t('filterButton')}
            </Button>
          </Flex>
        </Space>
      </div>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => renderDropdownContent()}
      onOpenChange={open => setIsDropdownOpen(open)}
      open={isDropdownOpen}
    >
      <Button
        icon={<DownOutlined />}
        iconPosition="end"
        style={{
          minWidth: 200,
          height: 36,
          borderRadius: 6,
          fontWeight: 500,
          border: isDropdownOpen ? '1px solid #1890ff' : '1px solid #d9d9d9',
          color: isDropdownOpen ? '#1890ff' : 'inherit',
          boxShadow: isDropdownOpen ? '0 0 0 2px rgba(24, 144, 255, 0.1)' : 'none',
          transition: 'all 0.2s ease',
        }}
        className="transition-all duration-200 hover:border-blue-400 hover:text-blue-500"
      >
        <Flex align="center" gap={6}>
          <CalendarOutlined style={{ fontSize: 14 }} />
          <span>{getDisplayLabel()}</span>
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default TimeWiseFilter;
