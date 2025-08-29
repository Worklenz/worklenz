import {
  Button,
  Drawer,
  Flex,
  Form,
  Input,
  message,
  Typography,
  Select,
  Spin,
} from '@/shared/antd-imports';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { toggleEditClientDrawer } from '../../features/clients-portal/clients/clients-slice';
import {
  useGetClientDetailsQuery,
  useUpdateClientMutation,
} from '../../api/client-portal/client-portal-api';
import { useEffect } from 'react';

const { Option } = Select;

const EditClientDrawer = () => {
  const { t } = useTranslation('client-portal-clients');

  const { isEditClientDrawerOpen, selectedClientId } = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer
  );

  const dispatch = useAppDispatch();

  // RTK Query hooks
  const {
    data: clientDetails,
    isLoading: isLoadingClient,
    error: clientError,
  } = useGetClientDetailsQuery(selectedClientId!, {
    skip: !selectedClientId,
  });

  // Extract client data from comprehensive response
  const client = clientDetails?.body;

  const [updateClient, { isLoading: isUpdating }] = useUpdateClientMutation();

  const [form] = Form.useForm();

  // Set form values when client data is loaded
  useEffect(() => {
    if (client && isEditClientDrawerOpen) {
      form.setFieldsValue({
        name: client.name,
        email: client.email,
        company_name: client.company_name,
        phone: client.phone,
        address: client.address,
        status: client.status,
      });
    }
  }, [client, isEditClientDrawerOpen, form]);

  const handleFormSubmit = async (values: any) => {
    if (!selectedClientId) return;

    try {
      await updateClient({
        id: selectedClientId,
        data: {
          name: values.name,
          email: values.email,
          company_name: values.company_name,
          phone: values.phone,
          address: values.address,
          status: values.status,
        },
      }).unwrap();

      message.success(t('updateClientSuccessMessage') || 'Client updated successfully');
      dispatch(toggleEditClientDrawer(null));
    } catch (error: any) {
      message.error(
        error?.data?.message || t('updateClientErrorMessage') || 'Failed to update client'
      );
    }
  };

  const handleDrawerClose = () => {
    dispatch(toggleEditClientDrawer(null));
    form.resetFields();
  };

  if (!selectedClientId) {
    return null;
  }

  return (
    <Drawer
      title={t('editClientTitle') || 'Edit Client'}
      placement="right"
      onClose={handleDrawerClose}
      open={isEditClientDrawerOpen}
      width={500}
      footer={
        <Flex gap={12} justify="flex-end">
          <Button onClick={handleDrawerClose}>{t('cancelButton') || 'Cancel'}</Button>
          <Button type="primary" onClick={() => form.submit()} loading={isUpdating}>
            {t('updateButton') || 'Update Client'}
          </Button>
        </Flex>
      }
    >
      <Spin spinning={isLoadingClient}>
        {clientError && (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="danger">
              {t('errorLoadingClient') || 'Error loading client data'}
            </Typography.Text>
          </div>
        )}

        <Form form={form} layout="vertical" onFinish={handleFormSubmit} autoComplete="off">
          <Form.Item
            name="name"
            label={t('clientNameLabel') || 'Client Name'}
            rules={[
              { required: true, message: t('clientNameRequired') || 'Please enter client name' },
              { min: 2, message: t('clientNameMinLength') || 'Name must be at least 2 characters' },
            ]}
          >
            <Input placeholder={t('clientNamePlaceholder') || 'Enter client name'} size="large" />
          </Form.Item>

          <Form.Item
            name="email"
            label={t('emailLabel') || 'Email Address'}
            rules={[
              { required: true, message: t('emailRequired') || 'Please enter email address' },
              { type: 'email', message: t('emailInvalid') || 'Please enter a valid email address' },
            ]}
          >
            <Input placeholder={t('emailPlaceholder') || 'Enter email address'} size="large" />
          </Form.Item>

          <Form.Item name="company_name" label={t('companyNameLabel') || 'Company Name'}>
            <Input
              placeholder={t('companyNamePlaceholder') || 'Enter company name (optional)'}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label={t('phoneLabel') || 'Phone Number'}
            rules={[
              {
                pattern: /^[\+]?[1-9][\d]{0,15}$/,
                message: t('phoneInvalid') || 'Please enter a valid phone number',
              },
            ]}
          >
            <Input
              placeholder={t('phonePlaceholder') || 'Enter phone number (optional)'}
              size="large"
            />
          </Form.Item>

          <Form.Item name="address" label={t('addressLabel') || 'Address'}>
            <Input.TextArea
              placeholder={t('addressPlaceholder') || 'Enter address (optional)'}
              rows={3}
            />
          </Form.Item>

          <Form.Item name="status" label={t('statusLabel') || 'Status'}>
            <Select size="large">
              <Option value="active">{t('statusActive') || 'Active'}</Option>
              <Option value="inactive">{t('statusInactive') || 'Inactive'}</Option>
              <Option value="pending">{t('statusPending') || 'Pending'}</Option>
            </Select>
          </Form.Item>
        </Form>
      </Spin>
    </Drawer>
  );
};

export default EditClientDrawer;
