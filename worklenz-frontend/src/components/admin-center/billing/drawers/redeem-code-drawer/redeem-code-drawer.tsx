import { Alert, Button, Drawer, Form, Input, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchBillingInfo,
  fetchStorageInfo,
  toggleRedeemCodeDrawer,
} from '@features/admin-center/admin-center.slice';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import logger from '@/utils/errorLogger';
import { setUser } from '@/features/user/userSlice';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

const APPSUMO_BUSINESS_UNLOCK_CODE_COUNT = 5;

const RedeemCodeDrawer: React.FC = () => {
  const [form] = Form.useForm();
  const { t } = useTranslation('admin-center/current-bill');
  const { isRedeemCodeDrawerOpen, billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const dispatch = useAppDispatch();

  const [redeemCode, setRedeemCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const redeemedCodesCount = billingInfo?.redeemed_codes_count ?? 0;
  const isBusinessPlanActivated = billingInfo?.plan_name === 'Business Plan';
  const shouldShowAppSumoBusinessUnlock =
    billingInfo?.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL &&
    redeemedCodesCount < APPSUMO_BUSINESS_UNLOCK_CODE_COUNT &&
    !isBusinessPlanActivated;

  const handleFormSubmit = async (values: any) => {
    if (!values.redeemCode) return;

    try {
      setIsLoading(true);
      const res = await adminCenterApiService.redeemCode(values.redeemCode);
      if (res.done) {
        form.resetFields();
        const authorizeResponse = await dispatch(verifyAuthentication()).unwrap();
        if (authorizeResponse?.authenticated) {
          dispatch(setUser(authorizeResponse.user));
        }
        dispatch(toggleRedeemCodeDrawer());
        dispatch(fetchBillingInfo());
        dispatch(fetchStorageInfo());
      }
    } catch (error) {
      logger.error('Error redeeming code', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Drawer
        title={
          <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
            {t('drawerTitle')}
          </Typography.Text>
        }
        open={isRedeemCodeDrawerOpen}
        onClose={() => {
          dispatch(toggleRedeemCodeDrawer());
          form.resetFields();
        }}
      >
        {shouldShowAppSumoBusinessUnlock && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 12 }}
            message={t('appsumoBusinessUnlockTitle', {
              defaultValue: 'Unlock Business Plan with 5 AppSumo codes',
            })}
            description={t('appsumoBusinessUnlockDescription', {
              count: redeemedCodesCount,
              required: APPSUMO_BUSINESS_UNLOCK_CODE_COUNT,
              defaultValue:
                'Redeem {{required}} AppSumo codes to automatically unlock Business Plan features. You have redeemed {{count}} of {{required}} codes.',
            })}
          />
        )}
        <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
          <Form.Item
            name="redeemCode"
            label={t('label')}
            rules={[
              {
                required: true,
                message: t('required'),
              },
              {
                pattern: /^[A-Za-z0-9]+$/,
                message: t('invalidCode'),
              },
            ]}
          >
            <Input
              placeholder={t('drawerPlaceholder')}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              count={{ show: true, max: 10 }}
              value={redeemCode}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              style={{ width: '100%' }}
              htmlType="submit"
              disabled={redeemCode.length !== 10}
              loading={isLoading}
            >
              {t('redeemSubmit')}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default RedeemCodeDrawer;
