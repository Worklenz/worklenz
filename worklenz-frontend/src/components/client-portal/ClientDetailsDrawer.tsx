import {
  Modal,
  Typography,
  Flex,
  Avatar,
  Tag,
  Button,
  List,
  Spin,
  Alert,
  Empty,
  message,
  Dropdown,
  Form,
  Input,
  Row,
  Col,
  Divider,
} from '@/shared/antd-imports';
import {
  UserOutlined,
  TeamOutlined,
  ProjectOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { toggleClientDetailsDrawer } from '../../features/clients-portal/clients/clients-slice';
import {
  UpdateClientRequest,
  useLazyGetClientDetailsQuery,
  useDeactivateClientMutation,
  useUpdateClientMutation,
} from '../../api/client-portal/client-portal-api';
import { useEffect } from 'react';
import PhoneInput from '@/components/PhoneInput/PhoneInput';
import { validatePhoneNumber } from '@/utils/validatePhoneNumber';
import { getCountries } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

const { Title, Text } = Typography;

const getDefaultPhoneCountry = (
  phoneCountryCodeValue?: string,
  countryValue?: string
): CountryCode => {
  const fallback: CountryCode = 'US';
  const supportedCountries = getCountries();

  if (phoneCountryCodeValue?.trim()) {
    const normalizedPhoneCountryCode = phoneCountryCodeValue.trim().toUpperCase() as CountryCode;
    if (supportedCountries.includes(normalizedPhoneCountryCode)) {
      return normalizedPhoneCountryCode;
    }
  }

  if (!countryValue || countryValue.trim() === '') {
    return fallback;
  }

  const normalizedCountry = countryValue.trim().toLowerCase();

  if (normalizedCountry.length === 2) {
    const alpha2 = normalizedCountry.toUpperCase() as CountryCode;
    if (supportedCountries.includes(alpha2)) {
      return alpha2;
    }
  }

  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const match = supportedCountries.find(code => {
      const regionName = regionNames.of(code)?.toLowerCase();
      return regionName === normalizedCountry;
    });

    return match || fallback;
  } catch {
    return fallback;
  }
};

const ClientDetailsDrawer = () => {
  const { t } = useTranslation('client-portal-clients');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { isClientDetailsDrawerOpen, selectedClientId } = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer
  );

  const [
    fetchClientDetails,
    {
      data: clientDetails,
      isLoading: isLoadingClient,
      error: clientError,
      reset: resetClientDetails,
    },
  ] = useLazyGetClientDetailsQuery();

  const client = clientDetails?.body;
  const clientStats = client?.stats;

  const [deactivateClient, { isLoading: isDeactivating }] = useDeactivateClientMutation();
  const [updateClient, { isLoading: isUpdating }] = useUpdateClientMutation();

  const [form] = Form.useForm();
  const phoneCountryCodeValue = Form.useWatch('phone_country_code', form);
  const countryValue = Form.useWatch('country', form);

  useEffect(() => {
    if (isClientDetailsDrawerOpen && selectedClientId) {
      form.resetFields();
      resetClientDetails();
      fetchClientDetails(selectedClientId, false);
    }
  }, [fetchClientDetails, form, isClientDetailsDrawerOpen, resetClientDetails, selectedClientId]);

  // Populate form whenever client data arrives
  useEffect(() => {
    if (client) {
      form.setFieldsValue({
        name: client.name,
        email: client.email,
        company_name: client.company_name,
        phone: client.phone,
        phone_country_code: client.phone_country_code,
        address_line_1: client.address_line_1,
        city: client.city,
        state: client.state,
        zip_code: client.zip_code,
        country: client.country,
        contact_person: client.contact_person,
      });
    }
  }, [client, form]);

  const handleClose = () => {
    form.resetFields();
    resetClientDetails();
    dispatch(toggleClientDetailsDrawer(null));
  };

  const handleFormSubmit = async (values: UpdateClientRequest) => {
    if (!selectedClientId) return;
    try {
      const result = await updateClient({
        id: selectedClientId,
        data: {
          name: values.name,
          email: values.email,
          company_name: values.company_name,
          phone: values.phone,
          phone_country_code: values.phone?.trim()
            ? values.phone_country_code
            : null,
          address_line_1: values.address_line_1,
          city: values.city,
          state: values.state,
          zip_code: values.zip_code,
          country: values.country,
          contact_person: values.contact_person,
        },
      }).unwrap();

      const response = result as any;
      if (response?.done === false) {
        throw new Error(
          response?.message ||
            t('updateClientErrorMessage', { defaultValue: 'Failed to update client' })
        );
      }

      message.success(t('updateClientSuccessMessage') || 'Client updated successfully');
      window.setTimeout(() => {
        handleClose();
      }, 600);
    } catch (error: any) {
      message.error(
        error?.data?.message || t('updateClientErrorMessage') || 'Failed to update client'
      );
    }
  };

  const handleDeactivateClient = async () => {
    if (!selectedClientId) return;
    try {
      await deactivateClient(selectedClientId).unwrap();
      message.success(t('deactivateClientSuccessMessage') || 'Client deactivated successfully');
      fetchClientDetails(selectedClientId, false);
      handleClose();
    } catch (error: any) {
      message.error(
        error?.data?.message || t('deactivateClientErrorMessage') || 'Failed to deactivate client'
      );
    }
  };

  const handleActivateClient = async () => {
    if (!selectedClientId) return;
    try {
      await updateClient({ id: selectedClientId, data: { status: 'active' } }).unwrap();
      message.success(t('activateClientSuccessMessage') || 'Client activated successfully');
      fetchClientDetails(selectedClientId, false);
    } catch (error: any) {
      message.error(
        error?.data?.message || t('activateClientErrorMessage') || 'Failed to activate client'
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'red';
      case 'pending':
        return 'orange';
      default:
        return 'default';
    }
  };

  const moreMenuItems =
    client?.status === 'inactive'
      ? [
          {
            key: 'activate',
            label: t('activateButton') || 'Activate Client',
            icon: <EditOutlined />,
            onClick: handleActivateClient,
          },
        ]
      : [
          {
            key: 'deactivate',
            label: t('deactivateButton') || 'Deactivate Client',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: handleDeactivateClient,
          },
        ];

  if (!selectedClientId || !isClientDetailsDrawerOpen) return null;

  return (
    <Modal
      open={isClientDetailsDrawerOpen}
      onCancel={handleClose}
      width={900}
      destroyOnClose
      styles={{
        body: {
          maxHeight: 'calc(100vh - 280px)',
          overflowY: 'auto',
          padding: '16px 24px',
        },
      }}
      title={
        <Flex align="center" justify="space-between" style={{ width: '100%', paddingRight: 24 }}>
          <Flex align="center" gap={14}>
            <Avatar
              size={52}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#1890ff', flexShrink: 0 }}
            />
            <div>
              <Title level={4} style={{ margin: 0, lineHeight: 1.3 }}>
                {client?.name || t('loadingText') || 'Loading…'}
              </Title>
              <Flex gap={8} align="center" style={{ marginTop: 2 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {client?.email}
                </Text>
                {client?.status && (
                  <Tag
                    color={getStatusColor(client.status)}
                    style={{ textTransform: 'capitalize', margin: 0 }}
                  >
                    {client.status}
                  </Tag>
                )}
              </Flex>
            </div>
          </Flex>

          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              icon={<MoreOutlined />}
              loading={isDeactivating}
              onClick={e => e.stopPropagation()}
            />
          </Dropdown>
        </Flex>
      }
      footer={
        <Flex justify="flex-end">
          <Button type="primary" onClick={() => form.submit()} loading={isUpdating}>
            {t('updateButton') || 'Save Changes'}
          </Button>
        </Flex>
      }
    >
      <Spin spinning={isLoadingClient}>
        {clientError && (
          <Alert
            message={t('errorTitle') || 'Error'}
            description="Failed to fetch client details"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* ── Editable fields ─────────────────────────────────────────── */}
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} autoComplete="off">
          <Row gutter={16}>
            <Col span={12}>
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
            <Col span={12}>
              <Form.Item
                name="email"
                label={t('emailLabel') || 'Email'}
                rules={[
                  { required: true, message: t('emailRequired') || 'Please enter email' },
                  { type: 'email', message: t('emailInvalid') || 'Enter a valid email' },
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="company_name"
                label={t('clientCompanyLabel', { defaultValue: 'Client / Company' })}
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
            <Col span={12}>
              <Form.Item
                name="phone"
                label={t('phoneLabel') || 'Phone'}
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
                  defaultCountry={getDefaultPhoneCountry(phoneCountryCodeValue, countryValue)}
                  onCountryChange={country => form.setFieldValue('phone_country_code', country)}
                  placeholder={t('phonePlaceholder', { defaultValue: 'Enter phone number' })}
                />
              </Form.Item>
              <Form.Item name="phone_country_code" hidden>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contact_person"
                label={t('primaryContactLabel', { defaultValue: 'Primary Contact (POC)' })}
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

          <Form.Item name="address_line_1" label={t('addressLine1Label') || 'Street Address'}>
            <Input placeholder="Enter street address" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label={t('cityLabel') || 'City'}>
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="state" label={t('stateLabel') || 'State / Province'}>
                <Input placeholder="State / Province" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="zip_code" label={t('zipCodeLabel') || 'Zip / Postal Code'}>
                <Input placeholder="Zip code" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="country" label={t('countryLabel') || 'Country'}>
                <Input placeholder="Country" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {/* ── Statistics ───────────────────────────────────────────────── */}
        {clientStats && (
          <>
            <Divider style={{ margin: '8px 0 12px' }} />
            <Row gutter={12} style={{ marginBottom: 16 }}>
              {[
                {
                  icon: <ProjectOutlined />,
                  value: clientStats.totalProjects ?? 0,
                  label: t('totalProjectsLabel') || 'Total Projects',
                  color: undefined,
                },
                {
                  icon: <ProjectOutlined />,
                  value: clientStats.activeProjects ?? 0,
                  label: t('activeProjectsLabel') || 'Active Projects',
                  color: '#3f8600',
                },
                {
                  icon: <TeamOutlined />,
                  value: clientStats.totalTeamMembers ?? 0,
                  label: t('totalTeamMembersLabel') || 'Team Members',
                  color: undefined,
                },
                {
                  icon: null,
                  value: clientStats.totalRequests ?? 0,
                  label: t('totalRequestsLabel') || 'Requests',
                  color: undefined,
                },
              ].map(stat => (
                <Col span={6} key={stat.label}>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(5, 5, 5, 0.08)',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        color: stat.color,
                      }}
                    >
                      {stat.value}
                    </div>
                    <Flex align="center" justify="center" gap={4} style={{ marginTop: 4 }}>
                      {stat.icon && (
                        <span style={{ fontSize: 11, opacity: 0.45 }}>{stat.icon}</span>
                      )}
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {stat.label}
                      </Typography.Text>
                    </Flex>
                  </div>
                </Col>
              ))}
            </Row>
          </>
        )}

        {/* ── Projects ─────────────────────────────────────────────────── */}
        {client && (
          <>
            {/* ── Projects ─────────────────────────────────────────────── */}
            <Divider style={{ margin: '8px 0 12px' }} orientation="left" orientationMargin={0}>
              <Flex align="center" gap={6}>
                <ProjectOutlined />
                <Text strong>{t('projectsTitle') || 'Projects'}</Text>
              </Flex>
            </Divider>
            {client.projects && client.projects.length > 0 ? (
              <List
                size="small"
                dataSource={client.projects}
                renderItem={project => (
                  <List.Item
                    actions={[
                      <Button
                        type="link"
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={() =>
                          project.id &&
                          navigate(
                            `/worklenz/projects/${project.id}?tab=tasks-list&pinned_tab=tasks-list`
                          )
                        }
                      >
                        {t('viewButton')}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={project.name}
                      description={
                        <Flex gap={8} align="center">
                          <Tag
                            color={project.status === 'active' ? 'green' : 'default'}
                            style={{ fontSize: 11 }}
                          >
                            {project.status}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {project.completedTasks}/{project.totalTasks}{' '}
                            {t('tasksCompletedText') || 'tasks completed'}
                          </Text>
                        </Flex>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                description={t('noProjectsText') || 'No projects'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </>
        )}
      </Spin>
    </Modal>
  );
};

export default ClientDetailsDrawer;
