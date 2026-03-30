import React, { useEffect, useState } from 'react';
import {
  Button,
  Modal,
  Flex,
  Form,
  Input,
  Typography,
  Spin,
  Alert,
  Row,
  Col,
  Divider,
} from '@/shared/antd-imports';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { toggleAddClientDrawer } from '../../features/clients-portal/clients/clients-slice';
import {
  CreateClientRequest,
  useCreateClientMutation,
} from '../../api/client-portal/client-portal-api';
import { refreshCsrfToken } from '../../api/api-client';
import PhoneInput from '@/components/PhoneInput/PhoneInput';
import { validatePhoneNumber } from '@/utils/validatePhoneNumber';

const getCreateClientErrorMessage = (
  errorMessage: string,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const normalizedMessage = errorMessage.toLowerCase();

  if (
    normalizedMessage.includes('clients_name_team_id_uindex') ||
    (normalizedMessage.includes('duplicate key value') && normalizedMessage.includes('name'))
  ) {
    return t('clientNameAlreadyExistsError', {
      defaultValue: 'A client with this name already exists. Use a different client name.',
    });
  }

  return (
    errorMessage ||
    t('createClientErrorMessage', {
      defaultValue: 'Failed to create client',
    })
  );
};

const AddClientDrawer = () => {
  const { t } = useTranslation('client-portal-clients');

  const isOpen = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer.isAddClientDrawerOpen
  );

  const dispatch = useAppDispatch();
  const [createClient, { isLoading }] = useCreateClientMutation();
  const [form] = Form.useForm();
  const [alertMessage, setAlertMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      refreshCsrfToken().catch(error => {
        console.error('Failed to refresh CSRF token:', error);
      });
      setAlertMessage(null);
    }
  }, [isOpen]);

  const handleFormSubmit = async (values: CreateClientRequest) => {
    try {
      await refreshCsrfToken();
      const result = await createClient({
        name: values.name,
        email: values.email,
        company_name: values.company_name,
        contact_person: values.contact_person,
        phone: values.phone,
        phone_country_code: values.phone?.trim() ? values.phone_country_code : undefined,
        address_line_1: values.address_line_1,
        city: values.city,
        state: values.state,
        zip_code: values.zip_code,
        country: values.country,
      }).unwrap();

      const response = result as any;
      if (response?.done === false) {
        throw new Error(
          response?.message ||
            t('createClientErrorMessage', { defaultValue: 'Failed to create client' })
        );
      }

      // Check if this is an existing client (backend returns body.existing)
      const responseBody = response?.body || response;

      if (responseBody?.existing) {
        // Show warning alert based on invitation status
        if (responseBody.invitationAlreadySent) {
          setAlertMessage({
            type: 'warning',
            message: t('clientExistsWithInvitationSent', {
              defaultValue:
                'A client with this email already exists and an invitation has already been sent.',
            }),
          });
        } else {
          setAlertMessage({
            type: 'warning',
            message: t('clientExistsNoInvitation', {
              defaultValue:
                'A client with this email already exists. You can send them an invitation from the clients list.',
            }),
          });
        }
      } else {
        // New client created successfully
        setAlertMessage({
          type: 'success',
          message: t('createClientSuccessMessage', {
            defaultValue:
              'Client created successfully! Share the organization invite link to give them portal access.',
          }),
        });
        window.setTimeout(() => {
          handleClose();
        }, 600);
      }
    } catch (error: any) {
      const errorMessage = error?.data?.message || error?.message || '';
      const normalizedErrorMessage = errorMessage.toLowerCase();
      const isCsrfError =
        normalizedErrorMessage.includes('csrf') ||
        normalizedErrorMessage.includes('security token') ||
        normalizedErrorMessage.includes('token expired') ||
        error?.status === 403;

      if (isCsrfError) {
        setAlertMessage({
          type: 'error',
          message: t('csrfError', { defaultValue: 'Security token expired. Please try again.' }),
        });
        refreshCsrfToken().catch(() => {});
      } else {
        setAlertMessage({
          type: 'error',
          message: getCreateClientErrorMessage(errorMessage, t),
        });
      }
    }
  };

  const handleClose = () => {
    dispatch(toggleAddClientDrawer());
    form.resetFields();
    setAlertMessage(null);
  };

  return (
    <Modal
      title={t('addClientTitle') || 'Add New Client'}
      open={isOpen}
      onCancel={handleClose}
      width={820}
      destroyOnClose
      styles={{
        body: {
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
        },
      }}
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
        {alertMessage && (
          <Alert
            type={alertMessage.type}
            message={alertMessage.message}
            showIcon
            closable
            onClose={() => setAlertMessage(null)}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} autoComplete="off">
          <Divider orientation="left" style={{ marginTop: 0 }}>
            <Typography.Text strong>
              {t('basicInformationSection', { defaultValue: 'Basic Information' })}
            </Typography.Text>
          </Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label={t('recordNameLabel', { defaultValue: 'Record Name (Internal)' })}
                rules={[
                  {
                    required: true,
                    message:
                      t('recordNameRequired', { defaultValue: 'Please enter an internal record name' }) ||
                      'Please enter an internal record name',
                  },
                  {
                    min: 2,
                    message:
                      t('recordNameMinLength', {
                        defaultValue: 'Record name must be at least 2 characters',
                      }) || 'Record name must be at least 2 characters',
                  },
                ]}
              >
                <Input
                  placeholder={
                    t('recordNamePlaceholder', {
                      defaultValue: 'Enter internal record name',
                    }) || 'Enter internal record name'
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
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
            <Col xs={24} md={12}>
              <Form.Item
                name="company_name"
                label={t('clientCompanyLabel', { defaultValue: 'Client / Company' })}
                rules={[
                  {
                    required: true,
                    message:
                      t('clientCompanyRequired', {
                        defaultValue: 'Please enter the client company name',
                      }) || 'Please enter the client company name',
                  },
                ]}
              >
                <Input
                  placeholder={
                    t('clientCompanyPlaceholder', {
                      defaultValue: 'Enter client company name',
                    }) || 'Enter client company name'
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="contact_person"
                label={t('primaryContactLabel', { defaultValue: 'Primary Contact (POC)' })}
                rules={[
                  {
                    required: true,
                    message:
                      t('primaryContactRequired', {
                        defaultValue: 'Please enter a primary contact person',
                      }) || 'Please enter a primary contact person',
                  },
                ]}
              >
                <Input
                  placeholder={
                    t('primaryContactPlaceholder', {
                      defaultValue: 'Enter primary contact (POC) name',
                    }) || 'Enter primary contact (POC) name'
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label={t('phoneLabel') || 'Phone Number'}
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value || value.trim() === '') {
                        return Promise.resolve();
                      }

                      if (validatePhoneNumber(value)) {
                        return Promise.resolve();
                      }

                      return Promise.reject(
                        new Error(
                          t('phoneInvalid', {
                            defaultValue: 'Please enter a valid phone number',
                          })
                        )
                      );
                    },
                  },
                ]}
              >
                <PhoneInput
                  placeholder={t('phonePlaceholder', { defaultValue: 'Enter phone number' })}
                />
              </Form.Item>
              <Form.Item name="phone_country_code" hidden>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">
            <Typography.Text strong>
              {t('contactInformationSection', { defaultValue: 'Contact Information' })}
            </Typography.Text>
          </Divider>

          <Form.Item name="address_line_1" label={t('addressLine1Label') || 'Street Address'}>
            <Input
              placeholder={t('addressLine1Placeholder') || 'Enter street address (optional)'}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="city" label={t('cityLabel') || 'City'}>
                <Input placeholder={t('cityPlaceholder') || 'City'} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="state" label={t('stateLabel') || 'State / Province'}>
                <Input placeholder={t('statePlaceholder') || 'State / Province'} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="zip_code" label={t('zipCodeLabel') || 'Zip / Postal Code'}>
                <Input placeholder={t('zipCodePlaceholder') || 'Zip code'} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="country" label={t('countryLabel') || 'Country'}>
            <Input placeholder={t('countryPlaceholder') || 'Country'} />
          </Form.Item>
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
