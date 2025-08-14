import { useState } from 'react';
import { Flex, DatePicker, Select, Button, Switch, Space, Popover, Badge, theme, Dropdown, Card, List, Typography, Divider } from '@/shared/antd-imports';
import { FilterOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { 
  setDateRange, 
  setFilters, 
  clearFilters, 
  setTimeScale,
  setCapacityUnit,
  toggleWeekends 
} from '@/features/project-workload/projectWorkloadSlice';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface WorkloadFiltersProps {
  onRefresh: () => void;
}

const WorkloadFilters = ({ onRefresh }: WorkloadFiltersProps) => {
  const { t } = useTranslation('workload');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const { 
    dateRange, 
    filters, 
    timeScale, 
    capacityUnit, 
    showWeekends 
  } = useAppSelector(state => state.projectWorkload);
  
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<string>('thisWeek');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);

  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setSelectedTimeFrame('');
      setCustomRange([dates[0].$d.toString(), dates[1].$d.toString()]);
    } else {
      setCustomRange(null);
    }
  };

  const applyCustomDateFilter = () => {
    if (customRange) {
      setSelectedTimeFrame('custom');
      setIsDateDropdownOpen(false);
      dispatch(setDateRange({
        startDate: dayjs(customRange[0]).format('YYYY-MM-DD'),
        endDate: dayjs(customRange[1]).format('YYYY-MM-DD'),
      }));
    }
  };

  const getDisplayLabel = () => {
    const f = 'MMM DD, YYYY';
    if (customRange && customRange.length === 2) {
      return `${dayjs(customRange[0]).format(f)} - ${dayjs(customRange[1]).format(f)}`;
    }
    return t(`filters.${selectedTimeFrame}`);
  };

  const dateRangeItems = [
    {
      key: 'today',
      label: 'today',
      dates: dayjs().format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD')
    },
    {
      key: 'yesterday',
      label: 'yesterday',
      dates: dayjs().subtract(1, 'day').format('YYYY-MM-DD') + ' - ' + dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    },
    {
      key: 'thisWeek',
      label: 'thisWeek',
      dates: dayjs().startOf('week').format('YYYY-MM-DD') + ' - ' + dayjs().endOf('week').format('YYYY-MM-DD')
    },
    {
      key: 'lastWeek',
      label: 'lastWeek',
      dates: dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD') + ' - ' + dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD')
    },
    {
      key: 'last7Days',
      label: 'last7Days',
      dates: dayjs().subtract(7, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD')
    },
    {
      key: 'thisMonth',
      label: 'thisMonth',
      dates: dayjs().startOf('month').format('YYYY-MM-DD') + ' - ' + dayjs().endOf('month').format('YYYY-MM-DD')
    },
    {
      key: 'lastMonth',
      label: 'lastMonth',
      dates: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD') + ' - ' + dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
    },
    {
      key: 'last30Days',
      label: 'last30Days',
      dates: dayjs().subtract(30, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD')
    },
    {
      key: 'last90Days',
      label: 'last90Days',
      dates: dayjs().subtract(90, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD')
    },
    {
      key: 'thisQuarter',
      label: 'thisQuarter',
      dates: dayjs().startOf('quarter').format('YYYY-MM-DD') + ' - ' + dayjs().endOf('quarter').format('YYYY-MM-DD')
    }
  ];

  const handleDurationSelect = (item: any) => {
    setSelectedTimeFrame(item.label);
    setCustomRange(null);
    const [startDate, endDate] = item.dates.split(' - ');
    dispatch(setDateRange({
      startDate,
      endDate,
    }));
    setIsDateDropdownOpen(false);
  };

  const activeFiltersCount = 
    (filters.showOverallocated ? 1 : 0) +
    (filters.showUnderutilized ? 1 : 0) +
    (filters.memberIds?.length || 0) +
    (filters.teamIds?.length || 0) +
    (filters.taskStatuses?.length || 0) +
    (filters.taskPriorities?.length || 0);

  const filterContent = (
    <Flex vertical gap={16} style={{ width: 300 }}>
      <div>
        <label style={{ display: 'block', marginBottom: 8 }}>
          {t('filters.capacityUnit')}
        </label>
        <Select
          value={capacityUnit}
          onChange={(value) => dispatch(setCapacityUnit(value))}
          style={{ width: '100%' }}
          options={[
            { label: t('filters.hours'), value: 'hours' },
            { label: t('filters.storyPoints'), value: 'points' },
          ]}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 8 }}>
          {t('filters.timeScale')}
        </label>
        <Select
          value={timeScale}
          onChange={(value) => dispatch(setTimeScale(value))}
          style={{ width: '100%' }}
          options={[
            { label: t('filters.daily'), value: 'day' },
            { label: t('filters.weekly'), value: 'week' },
            { label: t('filters.monthly'), value: 'month' },
          ]}
        />
      </div>

      <Flex justify="space-between" align="center">
        <span>{t('filters.showWeekends')}</span>
        <Switch 
          checked={showWeekends} 
          onChange={() => dispatch(toggleWeekends())}
        />
      </Flex>

      <Flex justify="space-between" align="center">
        <span>{t('filters.showOverallocated')}</span>
        <Switch 
          checked={filters.showOverallocated}
          onChange={(checked) => dispatch(setFilters({ showOverallocated: checked }))}
        />
      </Flex>

      <Flex justify="space-between" align="center">
        <span>{t('filters.showUnderutilized')}</span>
        <Switch 
          checked={filters.showUnderutilized}
          onChange={(checked) => dispatch(setFilters({ showUnderutilized: checked }))}
        />
      </Flex>

      <Button 
        type="text" 
        danger 
        onClick={() => dispatch(clearFilters())}
        disabled={activeFiltersCount === 0}
      >
        {t('filters.clearAll')}
      </Button>
    </Flex>
  );

  const timeWiseDropdownContent = (
    <Card
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
        {dateRangeItems.map(item => (
          <List.Item
            key={item.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 24,
              padding: '8px 12px',
              backgroundColor: selectedTimeFrame === item.label ? token.colorPrimaryBg : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => handleDurationSelect(item)}
          >
            <Typography.Text
              style={{
                color: selectedTimeFrame === item.label ? token.colorPrimary : 'inherit',
              }}
            >
              {t(`filters.${item.label}`)}
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

      <Flex vertical gap={8} style={{ padding: 12 }}>
        <Typography.Text>{t('filters.custom')}</Typography.Text>
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
          {t('common.save')}
        </Button>
      </Flex>
    </Card>
  );

  return (
    <Flex align="center" gap={12} wrap="wrap">
      <Dropdown
        trigger={['click']}
        dropdownRender={() => timeWiseDropdownContent}
        onOpenChange={open => setIsDateDropdownOpen(open)}
        open={isDateDropdownOpen}
      >
        <Button icon={<DownOutlined />} iconPosition="end">
          {getDisplayLabel()}
        </Button>
      </Dropdown>

      <Popover
        content={filterContent}
        title={t('filters.title')}
        trigger="click"
        open={filterPopoverOpen}
        onOpenChange={setFilterPopoverOpen}
        placement="bottomRight"
      >
        <Badge count={activeFiltersCount} offset={[-5, 5]}>
          <Button icon={<FilterOutlined />}>
            {t('filters.filters')}
          </Button>
        </Badge>
      </Popover>

      <Button 
        icon={<ReloadOutlined />} 
        onClick={onRefresh}
        title={t('filters.refresh')}
      />

      <Button 
        icon={<DownloadOutlined />}
        title={t('filters.export')}
      >
        {t('filters.export')}
      </Button>

      <Button 
        icon={<SettingOutlined />}
        title={t('filters.settings')}
      />
    </Flex>
  );
};

export default WorkloadFilters;