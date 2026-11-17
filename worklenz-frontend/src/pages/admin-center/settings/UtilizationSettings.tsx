import { useEffect, useState } from 'react';
import { Button, Card, Form, InputNumber, message, Space, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchWorkPolicySettings, updateWorkPolicySettings } from '@/features/admin-center/admin-center.slice';
import { IUtilizationSettings } from '@/api/admin-center/admin-center.api.service';

export const UtilizationSettings = () => {
  const { t } = useTranslation('admin-center/settings');
  const dispatch = useAppDispatch();
  const settings = useAppSelector(state => state.adminCenterReducer.workPolicySettings);
  const [form] = Form.useForm<IUtilizationSettings>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const load = async () => {
    setIsLoading(true);
    try { await dispatch(fetchWorkPolicySettings()).unwrap(); setHasError(false); }
    catch { setHasError(true); }
    finally { setIsLoading(false); }
  };
  useEffect(() => { void load(); }, [dispatch]);
  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);
  const save = async (values: IUtilizationSettings) => {
    setIsSaving(true);
    try {
      await dispatch(updateWorkPolicySettings(values)).unwrap();
      message.success(t('workPolicySaved', { defaultValue: 'Work policy settings saved successfully' }));
    } catch { message.error(t('errorSavingWorkPolicy', { defaultValue: 'Error saving work policy settings' })); }
    finally { setIsSaving(false); }
  };
  return <Card loading={isLoading}>
    {hasError ? <Space direction="vertical">
      <Typography.Text type="danger">{t('errorLoadingWorkPolicy', { defaultValue: 'Unable to load utilization settings.' })}</Typography.Text>
      <Button onClick={() => void load()}>{t('retry', { defaultValue: 'Retry' })}</Button>
    </Space> : <Form form={form} layout="vertical" onFinish={save}>
      <Typography.Paragraph>{t('utilizationThresholdHelp', { defaultValue: 'Set the optimal utilization range. Under is below the minimum and over is above the maximum.' })}</Typography.Paragraph>
      <Form.Item name="utilization_optimal_min_threshold_percent" label={t('optimalMinThreshold', { defaultValue: 'Optimal min (%)' })} rules={[{ required: true }, { type: 'number', min: 1, max: 200 }]}>
        <InputNumber min={1} max={200} precision={0} />
      </Form.Item>
      <Form.Item name="utilization_optimal_max_threshold_percent" label={t('optimalMaxThreshold', { defaultValue: 'Optimal max (%)' })} dependencies={['utilization_optimal_min_threshold_percent']} rules={[
        { required: true }, { type: 'number', min: 1, max: 200 },
        ({ getFieldValue }) => ({ validator: (_, value: number) => value > getFieldValue('utilization_optimal_min_threshold_percent') ? Promise.resolve() : Promise.reject(new Error(t('thresholdOrder', { defaultValue: 'Maximum must be greater than minimum' }))) }),
      ]}>
        <InputNumber min={1} max={200} precision={0} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={isSaving}>{t('saveUtilizationSettings', { defaultValue: 'Save Utilization Settings' })}</Button>
    </Form>}
  </Card>;
};
