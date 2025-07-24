import { useAppDispatch } from '@/hooks/useAppDispatch';
import { ScheduleData } from '@/types/schedule/schedule-v2.types';
import { Button, Col, DatePicker, Flex, Form, Input, Row } from '@/shared/antd-imports';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createSchedule, fetchTeamData } from './scheduleSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getDayName } from '@/utils/schedule';
import dayjs from 'dayjs';

const ProjectTimelineModal = ({
  setIsModalOpen,
  defaultData,
  projectId,
  memberId,
}: {
  setIsModalOpen: (x: boolean) => void;
  defaultData?: ScheduleData;
  projectId?: string;
  memberId?: string;
}) => {
  const [form] = Form.useForm();
  const { t } = useTranslation('schedule');
  const { workingDays } = useAppSelector(state => state.scheduleReducer);
  const dispatch = useAppDispatch();

  const handleFormSubmit = async (values: any) => {
    dispatch(
      createSchedule({ schedule: { ...values, project_id: projectId, team_member_id: memberId } })
    );
    form.resetFields();
    setIsModalOpen(false);
    dispatch(fetchTeamData());
  };

  const calTotalHours = async () => {
    const startDate = form.getFieldValue('allocated_from'); // Start date
    const endDate = form.getFieldValue('allocated_to'); // End date
    const secondsPerDay = form.getFieldValue('seconds_per_day'); // Seconds per day

    if (startDate && endDate && secondsPerDay && !isNaN(Number(secondsPerDay))) {
      const start: any = new Date(startDate);
      const end: any = new Date(endDate);

      if (start > end) {
        console.error('Start date cannot be after end date');
        return;
      }

      let totalWorkingDays = 0;
      for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
        if (workingDays.includes(getDayName(current))) {
          totalWorkingDays++;
        }
      }

      const hoursPerDay = secondsPerDay;

      const totalHours = totalWorkingDays * hoursPerDay;

      form.setFieldsValue({ total_seconds: totalHours.toFixed(2) });
    } else {
      form.setFieldsValue({ total_seconds: 0 });
    }
  };

  const disabledStartDate = (current: dayjs.Dayjs) => {
    const endDate = form.getFieldValue('allocated_to');
    return current && endDate ? current > dayjs(endDate) : false;
  };

  const disabledEndDate = (current: dayjs.Dayjs) => {
    const startDate = form.getFieldValue('allocated_from');
    return current && startDate ? current < dayjs(startDate) : false;
  };

  useEffect(() => {
    form.setFieldsValue({ allocated_from: dayjs(defaultData?.allocated_from) });
    form.setFieldsValue({ allocated_to: dayjs(defaultData?.allocated_to) });
  }, [defaultData]);

  return (
    <Form form={form} onFinish={handleFormSubmit}>
      <Flex vertical gap={10} style={{ width: '480px' }}>
        <Row>
          <Col
            span={12}
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingRight: '20px',
            }}
          >
            <span>{t('startDate')}</span>
            <Form.Item name="allocated_from">
              <DatePicker disabledDate={disabledStartDate} onChange={e => calTotalHours()} />
            </Form.Item>
          </Col>
          <Col
            span={12}
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingLeft: '20px',
            }}
          >
            <span>{t('endDate')}</span>
            <Form.Item name="allocated_to">
              <DatePicker disabledDate={disabledEndDate} onChange={e => calTotalHours()} />
            </Form.Item>
          </Col>
        </Row>
        <Row>
          <Col span={12} style={{ paddingRight: '20px' }}>
            <span>{t('hoursPerDay')}</span>
            <Form.Item name="seconds_per_day">
              <Input
                max={24}
                onChange={e => calTotalHours()}
                defaultValue={defaultData?.seconds_per_day}
                type="number"
                suffix="hours"
              />
            </Form.Item>
          </Col>

          <Col span={12} style={{ paddingLeft: '20px' }}>
            <span>{t('totalHours')}</span>
            <Form.Item name="total_seconds">
              <Input
                readOnly
                max={24}
                defaultValue={defaultData?.total_seconds}
                type="number"
                suffix="hours"
              />
            </Form.Item>
          </Col>
        </Row>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Button type="link">{t('deleteButton')}</Button>
          <div style={{ display: 'flex', gap: '5px' }}>
            <Button onClick={() => setIsModalOpen(false)}>{t('cancelButton')}</Button>
            <Button htmlType="submit" type="primary">
              {t('saveButton')}
            </Button>
          </div>
        </div>
      </Flex>
    </Form>
  );
};

export default React.memo(ProjectTimelineModal);
