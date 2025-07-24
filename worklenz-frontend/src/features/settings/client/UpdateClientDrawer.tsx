import { Button, Drawer, Form, Input, message, Typography } from '@/shared/antd-imports';
import React, { useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpdateClientDrawer, updateClient } from './clientSlice';
import { IClient } from '../../../types/client.types';
import { useTranslation } from 'react-i18next';

type UpdateClientDrawerProps = {
  selectedClientId: string | null;
};

const UpdateClientDrawer = ({ selectedClientId }: UpdateClientDrawerProps) => {
  // localization
  const { t } = useTranslation('settings/clients');

  // get data from client reducer
  const clientsList = useAppSelector(state => state.clientReducer.clients);

  // get data of currentlt selectedClient
  const selectedClient = clientsList.data?.find(client => client.id === selectedClientId);

  const isDrawerOpen = useAppSelector(state => state.clientReducer.isUpdateClientDrawerOpen);
  const dispatch = useAppDispatch();

  const [form] = Form.useForm();

  // Load the selected client details to the form when drawer opens
  useEffect(() => {
    if (selectedClient) {
      form.setFieldsValue({
        name: selectedClient.name,
      });
    }
  }, [selectedClient, form]);

  // this function for handle form submit
  const handleFormSubmit = async (values: any) => {
    try {
      if (selectedClient) {
        const updatedClient: IClient = {
          ...selectedClient,
          name: values.name,
        };

        dispatch(updateClient(updatedClient));
        dispatch(toggleUpdateClientDrawer());
        message.success(t('updateClientSuccessMessage'));
      }
    } catch (error) {
      message.error(t('updateClientErrorMessage'));
    }
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {t('updateClientDrawerTitle')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleUpdateClientDrawer())}
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
            {t('updateButton')}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default UpdateClientDrawer;
