import { Button, Checkbox, Col, Drawer, Form, Input, Row } from '@/shared/antd-imports';
import React, { ReactHTMLElement, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleSettingsDrawer, updateSettings } from './scheduleSlice';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

const ScheduleSettingsDrawer: React.FC = () => {
  const isDrawerOpen = useAppSelector(state => state.scheduleReducer.isSettingsDrawerOpen);
  const dispatch = useDispatch();
  const { t } = useTranslation('schedule');

  const [workingDays, setWorkingDays] = useState([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ]);
  const [workingHours, setWorkingHours] = useState(8);

  const onChangeWorkingDays = (checkedValues: string[]) => {
    setWorkingDays(checkedValues);
  };

  const onChangeWorkingHours = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkingHours(Number(e.target.value));
  };

  const onSave = () => {
    dispatch(updateSettings({ workingDays, workingHours }));
    dispatch(toggleSettingsDrawer());
  };

  return (
    <div>
      <Drawer
        title={t('settings')}
        open={isDrawerOpen}
        onClose={() => {
          dispatch(toggleSettingsDrawer());
        }}
      >
        <Form layout="vertical">
          <Form.Item label={t('workingDays')}>
            <Checkbox.Group defaultValue={workingDays} onChange={onChangeWorkingDays}>
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

          <Form.Item label={t('workingHours')}>
            <Input
              max={24}
              defaultValue={workingHours}
              type="number"
              suffix={<span style={{ color: 'rgba(0, 0, 0, 0.46)' }}>{t('hours')}</span>}
              onChange={onChangeWorkingHours}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" style={{ width: '100%' }} onClick={onSave}>
              {t('saveButton')}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default ScheduleSettingsDrawer;
