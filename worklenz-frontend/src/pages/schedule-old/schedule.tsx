import { Button, DatePicker, DatePickerProps, Select, Space } from '@/shared/antd-imports';
import React, { Suspense, useState } from 'react';
import Team from '../../components/schedule-old/team/Team';
import { SettingOutlined } from '@/shared/antd-imports';
import { useDispatch } from 'react-redux';
import { toggleSettingsDrawer } from '@/features/schedule-old/scheduleSlice';
import ScheduleSettingsDrawer from '@/features/schedule-old/ScheduleSettingsDrawer';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const { Option } = Select;

type PickerType = 'week' | 'month';

const PickerWithType = ({
  type,
  onChange,
}: {
  type: PickerType;
  onChange: DatePickerProps['onChange'];
}) => {
  return <DatePicker picker={type} onChange={onChange} />;
};

const Schedule: React.FC = () => {
  const [type, setType] = useState<PickerType>('week');
  const [date, setDate] = useState<Date | null>(null);
  const { t } = useTranslation('schedule');

  const dispatch = useDispatch();

  useDocumentTitle('Schedule');

  const handleDateChange = (value: dayjs.Dayjs | null) => {
    if (!value) return;
    let selectedDate = value.toDate();

    // If 'Month' is selected, default to the first day of the selected month
    if (type === 'month') {
      selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    }

    setDate(selectedDate);
  };

  const handleToday = () => {
    const today = new Date();
    setDate(today);
  };

  return (
    <Suspense fallback={<SuspenseFallback />}>
      <div style={{ marginBlock: 65, minHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              paddingTop: '25px',
              paddingBottom: '20px',
            }}
          >
            <Button onClick={handleToday}>{t('today')}</Button>
            <Space>
              <Select value={type} onChange={value => setType(value as PickerType)}>
                <Option value="week">{t('week')}</Option>
                <Option value="month">{t('month')}</Option>
              </Select>
              <PickerWithType type={type} onChange={handleDateChange} />
            </Space>
          </div>
          <Button size="small" shape="circle" onClick={() => dispatch(toggleSettingsDrawer())}>
            <SettingOutlined />
          </Button>
        </div>

        <div>
          <Team date={date} />
        </div>
        <ScheduleSettingsDrawer />
      </div>
    </Suspense>
  );
};

export default Schedule;
