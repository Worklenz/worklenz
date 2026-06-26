import { Button, Checkbox, Col, Drawer, Form, Input, Row } from '@/shared/antd-imports';
import React, { useEffect, useRef } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchDateList,
  fetchTeamData,
  getWorking,
  toggleSettingsDrawer,
  updateWorking,
  triggerScheduleRefresh,
} from './scheduleSlice';
import { useTranslation } from 'react-i18next';
import Skeleton from 'antd/es/skeleton/Skeleton';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { scheduleApi } from '@/api/schedule/scheduleApi';

const ScheduleSettingsDrawer: React.FC = () => {
  const isDrawerOpen = useAppSelector(state => state.scheduleReducer.isSettingsDrawerOpen);
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const { t } = useTranslation('schedule');

  const { workingDays, workingHours, loading } = useAppSelector(state => state.scheduleReducer);
  const { date, type } = useAppSelector(state => state.scheduleReducer);

  // Track if settings have been loaded at least once
  const hasLoadedSettings = useRef(false);

  // Load settings only once when component mounts or when drawer opens for the first time
  useEffect(() => {
    if (isDrawerOpen && !hasLoadedSettings.current) {
      dispatch(getWorking());
      hasLoadedSettings.current = true;
    }
  }, [isDrawerOpen, dispatch]);

  // Update form values when settings change
  useEffect(() => {
    if (workingDays.length > 0 || workingHours > 0) {
      form.setFieldsValue({ workingDays, workingHours });
    }
  }, [workingDays, workingHours, form]);

  const handleFormSubmit = async (values: any) => {
    try {
      await dispatch(updateWorking(values)).unwrap();
      dispatch(toggleSettingsDrawer());
      dispatch(fetchDateList({ date, type }));
      dispatch(fetchTeamData());

      // Invalidate all schedule-related cache to force refetch
      dispatch(
        scheduleApi.util.invalidateTags([
          'DateList',
          'Members',
          'MemberProjects',
          'Capacity',
          'Workload',
          'CapacityReport',
          'Conflicts',
          'TaskTimeline',
          'TimeOff',
        ])
      );

      // Trigger refresh in the schedule page
      dispatch(triggerScheduleRefresh());
    } catch (error) {
      console.error('Failed to update schedule settings:', error);
    }
  };

  return (
    <Drawer
      title={t('settings', { defaultValue: 'Settings' })}
      open={isDrawerOpen}
      onClose={() => {
        dispatch(toggleSettingsDrawer());
      }}
    >
      <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
        <Form layout="vertical" form={form} onFinish={handleFormSubmit}>
          <Form.Item label={t('workingDays', { defaultValue: 'Working Days' })} name="workingDays">
            <Checkbox.Group>
              <Row>
                <Col span={8} style={{ paddingBottom: '8px' }}>
                  <Checkbox value="Monday">{t('monday', { defaultValue: 'Monday' })}</Checkbox>
                </Col>
                <Col span={8} style={{ paddingBottom: '8px' }}>
                  <Checkbox value="Tuesday">{t('tuesday', { defaultValue: 'Tuesday' })}</Checkbox>
                </Col>
                <Col span={8} style={{ paddingBottom: '8px' }}>
                  <Checkbox value="Wednesday">
                    {t('wednesday', { defaultValue: 'Wednesday' })}
                  </Checkbox>
                </Col>
                <Col span={8} style={{ paddingBottom: '8px' }}>
                  <Checkbox value="Thursday">
                    {t('thursday', { defaultValue: 'Thursday' })}
                  </Checkbox>
                </Col>
                <Col span={8} style={{ paddingBottom: '8px' }}>
                  <Checkbox value="Friday">{t('friday', { defaultValue: 'Friday' })}</Checkbox>
                </Col>
                <Col span={8} style={{ paddingBottom: '8px' }}>
                  <Checkbox value="Saturday">
                    {t('saturday', { defaultValue: 'Saturday' })}
                  </Checkbox>
                </Col>
                <Col span={8} style={{ paddingBottom: '8px' }}>
                  <Checkbox value="Sunday">{t('sunday', { defaultValue: 'Sunday' })}</Checkbox>
                </Col>
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            label={t('workingHours', { defaultValue: 'Working Hours' })}
            name="workingHours"
          >
            <Input
              max={24}
              type="number"
              suffix={
                <span style={{ color: 'rgba(0, 0, 0, 0.46)' }}>
                  {t('hours', { defaultValue: 'hours' })}
                </span>
              }
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              {t('saveButton', { defaultValue: 'Save' })}
            </Button>
          </Form.Item>
        </Form>
      </Skeleton>
    </Drawer>
  );
};

export default ScheduleSettingsDrawer;
