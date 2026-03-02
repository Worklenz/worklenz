import React, { useEffect } from 'react';
import {
  Button,
  Modal,
  Flex,
  Form,
  Input,
  message,
  Typography,
  Select,
  Spin,
  Alert,
  Row,
  Col,
} from '@/shared/antd-imports';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { toggleAddClientDrawer } from '../../features/clients-portal/clients/clients-slice';
import { useCreateClientMutation } from '../../api/client-portal/client-portal-api';
import { refreshCsrfToken } from '../../api/api-client';

const { Option } = Select;

const AddClientDrawer = () => {
  const { t } = useTranslation('client-portal-clients');

  const isOpen = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer.isAddClientDrawerOpen
  );

  const dispatch = useAppDispatch();
  const [createClient, { isLoading }] = useCreateClientMutation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (isOpen) {
      refreshCsrfToken().catch(error => {
        console.error('Failed to refresh CSRF token:', error);
      });
    }
  }, [isOpen]);

  const handleFormSubmit = async (values: any) => {
    try {
      await refreshCsrfToken();
      await createClient({
        name: values.name,
        email: values.email,
        company_name: values.company_name,
        phone: values.phone,
        address_line_1: values.address_line_1,
        city: values.city,
        state: values.state,
        zip_code: values.zip_code,
        country: values.country,
      }).unwrap();

      form.resetFields();
      message.success(
        t('createClientSuccessMessage') ||
          'Client created successfully! Share the organization invite link to give them portal access.',
        5
      );
      dispatch(toggleAddClientDrawer());
    } catch (error: any) {
      const errorMessage = error?.data?.message || error?.message || '';
      const isCsrfError =
        errorMessage.toLowerCase().includes('csrf') ||
        errorMessage.toLowerCase().includes('invalid') ||
        error?.status === 403;

      if (isCsrfError) {
        message.error(t('csrfError') || 'Security token expired. Please try again.', 5);
        refreshCsrfToken().catch(() => {});
      } else {
        message.error(
          errorMessage || t('createClientErrorMessage') || 'Failed to create client'
        );
      }
    }
  };

  const handleClose = () => {
    dispatch(toggleAddClientDrawer());
    form.resetFields();
  };

  return (
    <Modal
      title={t('addClientTitle') || 'Add New Client'}
      open={isOpen}
      onCancel={handleClose}
      width={580}
      destroyOnClose
      footer={
        <Flex gap={8} justify="flex-end">
          <Button onClick={handleClose}>{t('cancelButton') || 'Cancel'}</Button>
          <Button type="primary" onClick={() => form.submit()} loading={isLoading}>
            {t('createButton') || 'Create Client'}
          </Button>
        </Flex>
      }
    >
      <Spin spinning={isLoading}>
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} autoComplete="off">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('clientNameLabel') || 'Client Name'}
                rules={[
                  { required: true, message: t('clientNameRequired') || 'Please enter client name' },
                  { min: 2, message: t('clientNameMinLength') || 'At least 2 characters' },
                ]}
              >
                <Input placeholder={t('clientNamePlaceholder') || 'Enter client name'} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label={t('emailLabel') || 'Email Address'}
                rules={[
                  { required: true, message: t('emailRequired') || 'Please enter email address' },
                  { type: 'email', message: t('emailInvalid') || 'Please enter a valid email' },
                ]}
              >
                <Input placeholder={t('emailPlaceholder') || 'Enter email address'} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company_name" label={t('companyNameLabel') || 'Company Name'}>
                <Input placeholder={t('companyNamePlaceholder') || 'Enter company name'} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label={t('phoneLabel') || 'Phone Number'}
                rules={[
                  {
                    pattern: /^[\+]?[1-9][\d]{0,15}$/,
                    message: t('phoneInvalid') || 'Enter a valid phone number',
                  },
                ]}
              >
                <Input placeholder={t('phonePlaceholder') || 'Enter phone number'} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address_line_1" label={t('addressLine1Label') || 'Street Address'}>
            <Input placeholder={t('addressLine1Placeholder') || 'Enter street address (optional)'} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label={t('cityLabel') || 'City'}>
                <Input placeholder={t('cityPlaceholder') || 'City'} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="state" label={t('stateLabel') || 'State / Province'}>
                <Input placeholder={t('statePlaceholder') || 'State / Province'} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="zip_code" label={t('zipCodeLabel') || 'Zip / Postal Code'}>
                <Input placeholder={t('zipCodePlaceholder') || 'Zip code'} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="country" label={t('countryLabel') || 'Country'}>
                <Input placeholder={t('countryPlaceholder') || 'Country'} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="status"
                label={t('statusLabel') || 'Status'}
                initialValue="pending"
              >
                <Select>
                  <Option value="active">{t('statusActive') || 'Active'}</Option>
                  <Option value="inactive">{t('statusInactive') || 'Inactive'}</Option>
                  <Option value="pending">{t('statusPending') || 'Pending'}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Alert
          type="info"
          showIcon
          message={
            <Typography.Text style={{ fontSize: 12 }}>
              {t('clientInvitationEmailInfo') ||
                'An invitation email will be sent to the client to join the portal. You can also share the invite link from the Clients page.'}
            </Typography.Text>
          }
        />
      </Spin>
    </Modal>
  );
};

export default AddClientDrawer;
