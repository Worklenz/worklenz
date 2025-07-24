import { Button, Checkbox, Col, Drawer, Form, Input, Row } from '@/shared/antd-imports';
import React, { ReactHTMLElement, useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchDateList,
  fetchTeamData,
  getWorking,
  toggleSettingsDrawer,
  updateSettings,
  updateWorking,
} from './scheduleSlice';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { scheduleAPIService } from '@/api/schedule/schedule.api.service';
import Skeleton from 'antd/es/skeleton/Skeleton';
import { useAppDispatch } from '@/hooks/useAppDispatch';

const ScheduleSettingsDrawer: React.FC = () => {
  const isDrawerOpen = useAppSelector(state => state.scheduleReducer.isSettingsDrawerOpen);
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const { t } = useTranslation('schedule');

  const { workingDays, workingHours, loading } = useAppSelector(state => state.scheduleReducer);
  const { date, type } = useAppSelector(state => state.scheduleReducer);

  const handleFormSubmit = async (values: any) => {
    await dispatch(updateWorking(values));
    dispatch(toggleSettingsDrawer());
    dispatch(fetchDateList({ date, type }));
    dispatch(fetchTeamData());
  };

  const fetchSettings = async () => {
    dispatch(getWorking());
  };

  useEffect(() => {
    form.setFieldsValue({ workingDays, workingHours });
  }, [workingDays, workingHours]);

  return (
    <div>
      <Drawer
        title={t('settings')}
        open={isDrawerOpen}
        onClose={() => {
          dispatch(toggleSettingsDrawer());
        }}
        destroyOnClose
        afterOpenChange={() => {
          fetchSettings();
        }}
      >
        <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
          <Form layout="vertical" form={form} onFinish={handleFormSubmit}>
            <Form.Item label={t('workingDays')} name="workingDays">
              <Checkbox.Group defaultValue={workingDays}>
                <Row>
                  <Col span={8} style={{ paddingBottom: '8px' }}>
                    <Checkbox value="Monday">{t('monday')}</Checkbox>
                  </Col>
                  <Col span={8} style={{ paddingBottom: '8px' }}>
                    <Checkbox value="Tuesday">{t('tuesday')}</Checkbox>
                  </Col>
                  <Col span={8} style={{ paddingBottom: '8px' }}>
                    <Checkbox value="Wednesday">{t('wednesday')}</Checkbox>
                  </Col>
                  <Col span={8} style={{ paddingBottom: '8px' }}>
                    <Checkbox value="Thursday">{t('thursday')}</Checkbox>
                  </Col>
                  <Col span={8} style={{ paddingBottom: '8px' }}>
                    <Checkbox value="Friday">{t('friday')}</Checkbox>
                  </Col>
                  <Col span={8} style={{ paddingBottom: '8px' }}>
                    <Checkbox value="Saturday">{t('saturday')}</Checkbox>
                  </Col>
                  <Col span={8} style={{ paddingBottom: '8px' }}>
                    <Checkbox value="Sunday">{t('sunday')}</Checkbox>
                  </Col>
                </Row>
              </Checkbox.Group>
            </Form.Item>

            <Form.Item label={t('workingHours')} name="workingHours">
              <Input
                max={24}
                type="number"
                suffix={<span style={{ color: 'rgba(0, 0, 0, 0.46)' }}>{t('hours')}</span>}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
                {t('saveButton')}
              </Button>
            </Form.Item>
          </Form>
        </Skeleton>
      </Drawer>
    </div>
  );
};

export default ScheduleSettingsDrawer;
