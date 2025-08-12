import { Button, Drawer, Form, Input, message, Typography } from '@/shared/antd-imports';
import { useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  createClient,
  toggleClientDrawer,
  updateClient,
} from '@/features/settings/client/clientSlice';
import { IClient } from '@/types/client.types';
import { useTranslation } from 'react-i18next';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_clients_create } from '@/shared/worklenz-analytics-events';

type ClientDrawerProps = {
  client: IClient | null;
  drawerClosed: () => void;
};

const ClientDrawer = ({ client, drawerClosed }: ClientDrawerProps) => {
  const { t } = useTranslation('settings/clients');
  const { isClientDrawerOpen } = useAppSelector(state => state.clientReducer);
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const { trackMixpanelEvent } = useMixpanelTracking();

  useEffect(() => {
    if (client?.name) {
      form.setFieldsValue({ name: client.name });
    }
  }, [client, form]);

  const handleFormSubmit = async (values: { name: string }) => {
    try {
      if (client && client.id) {
        await dispatch(updateClient({ id: client.id, body: { name: values.name } }));
      } else {
        trackMixpanelEvent(evt_settings_clients_create);
        await dispatch(createClient({ name: values.name }));
      }
      dispatch(toggleClientDrawer());
      drawerClosed();
    } catch (error) {
      message.error(t('updateClientErrorMessage'));
    }
  };

  const handleClose = () => {
    dispatch(toggleClientDrawer());
    drawerClosed();
    client = null;
    form.resetFields();
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {client ? t('updateClientDrawerTitle') : t('createClientDrawerTitle')}
        </Typography.Text>
      }
      open={isClientDrawerOpen}
      onClose={handleClose}
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          name="name"
          label={t('nameLabel')}
          rules={[
            {
              required: true,
              message: t('nameRequiredError'),
            },
          ]}
        >
          <Input placeholder={t('namePlaceholder')} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" style={{ width: '100%' }} htmlType="submit">
            {client ? t('updateButton') : t('createButton')}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default ClientDrawer;
