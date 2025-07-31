import { CaretDownFilled, DownOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Divider, Dropdown, Flex, List, Typography } from 'antd';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

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

  // Format customRange for display
  const getDisplayLabel = () => {
    const f = 'YY-MM-DD';
    if (customRange && customRange.length === 2) {
      return `${dayjs(customRange[0]).format(f)} - ${dayjs(customRange[1]).format(f)}`;
    }
    return t(selectedTimeFrame);
  };

  // Apply changes when date range is selected
  const handleDateRangeChange = (dates: any, dateStrings: [string, string]) => {
    if (dates) {
      setSelectedTimeFrame('');
      setCustomRange([dates[0].$d.toString(), dates[1].$d.toString()]);
    } else {
      setCustomRange(null);
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
      dispatch(setDateRange([]));
    }
  }, [duration]);

  // custom dropdown content
  const timeWiseDropdownContent = (
    <Card
      className="custom-card"
      styles={{
        body: {
          padding: 0,
          minWidth: 320,
          maxHeight: 330,
          overflowY: 'auto',
        },
      }}
    >
      <List style={{ padding: 0 }}>
        {durations.map(item => (
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={item.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 24,
              padding: '4px 8px',
              backgroundColor:
                selectedTimeFrame === item.label && themeMode === 'dark'
                  ? '#424242'
                  : selectedTimeFrame === item.label && themeMode === 'light'
                    ? colors.paleBlue
                    : colors.transparent,
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => handleDurationSelect(item)}
          >
            <Typography.Text
              style={{
                color: selectedTimeFrame === item.label ? colors.skyBlue : 'inherit',
              }}
            >
              {t(item.label)}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {item.dates
                ? dayjs(item.dates.split(' - ')[0]).format('MMM DD, YYYY') +
                  ' - ' +
                  dayjs(item.dates.split(' - ')[1]).format('MMM DD, YYYY')
                : ''}
            </Typography.Text>
          </List.Item>
        ))}
      </List>

      <Divider style={{ marginBlock: 12 }} />

      <Flex vertical gap={8} style={{ padding: 8 }}>
        <Typography.Text>{t('customRangeText')}</Typography.Text>

        <DatePicker.RangePicker
          format={'MMM DD, YYYY'}
          onChange={handleDateRangeChange}
          value={customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null}
        />

        <Button
          type="primary"
          size="small"
          style={{ width: 'fit-content', alignSelf: 'flex-end' }}
          onClick={applyCustomDateFilter}
          disabled={!customRange}
        >
          {t('filterButton')}
        </Button>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => timeWiseDropdownContent}
      onOpenChange={open => setIsDropdownOpen(open)}
      open={isDropdownOpen}
    >
      <Button
        icon={<DownOutlined />}
        iconPosition="end"
        className={`transition-colors duration-300 ${
          isDropdownOpen
            ? 'border-[#1890ff] text-[#1890ff]'
            : 'hover:text-[#1890ff hover:border-[#1890ff]'
        }`}
      >
        {getDisplayLabel()}
      </Button>
    </Dropdown>
  );
};

export default TimeWiseFilter;
