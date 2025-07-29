import { Button, Drawer, Form, Input, notification, Typography } from '@/shared/antd-imports';
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
import { authApiService } from '@/api/auth/auth.api.service';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
const RedeemCodeDrawer: React.FC = () => {
  const [form] = Form.useForm();
  const { t } = useTranslation('admin-center/current-bill');
  const { isRedeemCodeDrawerOpen } = useAppSelector(state => state.adminCenterReducer);
  const dispatch = useAppDispatch();

  const [redeemCode, setRedeemCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFormSubmit = async (values: any) => {
    if (!values.redeemCode) return;

    try {
      setIsLoading(true);
      const res = await adminCenterApiService.redeemCode(values.redeemCode);
      if (res.done) {
        form.resetFields();
        const authorizeResponse = await authApiService.verify();
        if (authorizeResponse.authenticated) {
          setSession(authorizeResponse.user);
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
