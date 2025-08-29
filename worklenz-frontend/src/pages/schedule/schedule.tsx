import { Button, DatePicker, DatePickerProps, Flex, Select, Space } from '@/shared/antd-imports';
import React, { useRef, useEffect } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_schedule_page_visit } from '@/shared/worklenz-analytics-events';
import { SettingOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { setDate, setType, toggleSettingsDrawer } from '@/features/schedule/scheduleSlice';
import ScheduleSettingsDrawer from '@/features/schedule/ScheduleSettingsDrawer';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import ScheduleDrawer from '@/features/schedule/ScheduleDrawer';
import GranttChart from '@/components/schedule/grant-chart/GranttChart';
import ScheduleDataDebugger from '@/components/schedule/ScheduleDataDebugger';
import { useAppSelector } from '@/hooks/useAppSelector';
import { PickerType } from '@/types/schedule/schedule-v2.types';

const { Option } = Select;

const PickerWithType = ({
  type,
  onChange,
  date,
}: {
  type: PickerType;
  onChange: DatePickerProps['onChange'];
  date?: Date;
}) => {
  return <DatePicker value={dayjs(date)} picker={type} onChange={onChange} />;
};

const Schedule: React.FC = () => {
  const { t } = useTranslation('schedule');
  const dispatch = useDispatch();
  const granttChartRef = useRef<any>(null);
  const { date, type } = useAppSelector(state => state.scheduleReducer);
  const { trackMixpanelEvent } = useMixpanelTracking();

  useDocumentTitle('Schedule');

  useEffect(() => {
    trackMixpanelEvent(evt_schedule_page_visit);
  }, [trackMixpanelEvent]);

  const handleDateChange = (value: dayjs.Dayjs | null) => {
    if (!value) return;
    let selectedDate = value.toDate();

    // If 'Month' is selected, default to the first day of the selected month
    if (type === 'month') {
      selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    }

    dispatch(setDate(selectedDate));
  };

  const handleToday = () => {
    const today = new Date();
    setDate(today);
    granttChartRef.current?.scrollToToday();
    console.log('Today:', today);
  };

  return (
    <div style={{ minHeight: '90vh' }}>
      <Flex align="center" justify="space-between">
        <Flex
          gap={16}
          align="center"
          style={{
            paddingTop: '25px',
            paddingBottom: '20px',
          }}
        >
          <Button onClick={handleToday}>{t('today')}</Button>
          <Space>
            <Select value={type} onChange={value => dispatch(setType(value))}>
              <Option value="week">{t('week')}</Option>
              <Option value="month">{t('month')}</Option>
            </Select>
            <PickerWithType date={date as Date} type={type} onChange={handleDateChange} />
          </Space>
        </Flex>
        <Button size="small" shape="circle" onClick={() => dispatch(toggleSettingsDrawer())}>
          <SettingOutlined />
        </Button>
      </Flex>

      <Flex vertical gap={24}>
        <GranttChart type={type} date={date} ref={granttChartRef} />
      </Flex>

      <ScheduleSettingsDrawer />
      <ScheduleDrawer />
    </div>
  );
};

export default Schedule;
