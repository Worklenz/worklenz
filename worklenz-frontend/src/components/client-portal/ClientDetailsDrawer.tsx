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
  Select,
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
  useGetClientDetailsQuery,
  useDeactivateClientMutation,
  useUpdateClientMutation,
} from '../../api/client-portal/client-portal-api';
import { useEffect } from 'react';

const { Title, Text } = Typography;
const { Option } = Select;

const ClientDetailsDrawer = () => {
  const { t } = useTranslation('client-portal-clients');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { isClientDetailsDrawerOpen, selectedClientId } = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer
  );

  const {
    data: clientDetails,
    isLoading: isLoadingClient,
    error: clientError,
    refetch: refetchClientDetails,
  } = useGetClientDetailsQuery(selectedClientId || '', {
    skip: !selectedClientId,
  });

  const client = clientDetails?.body;
  const clientStats = client?.stats;

  const [deactivateClient, { isLoading: isDeactivating }] = useDeactivateClientMutation();
  const [updateClient, { isLoading: isUpdating }] = useUpdateClientMutation();

  const [form] = Form.useForm();

  // Populate form whenever client data arrives
  useEffect(() => {
    if (client) {
      form.setFieldsValue({
        name: client.name,
        email: client.email,
        company_name: client.company_name,
        phone: client.phone,
        address_line_1: (client as any).address_line_1,
        city: (client as any).city,
        state: (client as any).state,
        zip_code: (client as any).zip_code,
        country: (client as any).country,
        status: client.status,
        contact_person: (client as any).contact_person,
      });
    }
  }, [client, form]);

  const handleClose = () => {
    dispatch(toggleClientDetailsDrawer(null));
    form.resetFields();
  };

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
          address_line_1: values.address_line_1,
          city: values.city,
          state: values.state,
          zip_code: values.zip_code,
          country: values.country,
          status: values.status,
          contact_person: values.contact_person,
        },
      }).unwrap();
      message.success(t('updateClientSuccessMessage') || 'Client updated successfully');
      refetchClientDetails();
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
      refetchClientDetails();
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
      refetchClientDetails();
    } catch (error: any) {
      message.error(
        error?.data?.message || t('activateClientErrorMessage') || 'Failed to activate client'
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':  return 'green';
      case 'inactive': return 'red';
      case 'pending':  return 'orange';
      default:         return 'default';
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
                label={t('clientNameLabel') || 'Client Name'}
                rules={[
                  { required: true, message: t('clientNameRequired') || 'Please enter client name' },
                  { min: 2, message: t('clientNameMinLength') || 'At least 2 characters' },
                ]}
              >
                <Input placeholder="Enter client name" />
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
              <Form.Item name="company_name" label={t('companyNameLabel') || 'Company'}>
                <Input placeholder="Enter company name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label={t('phoneLabel') || 'Phone'}
                rules={[
                  {
                    pattern: /^[\+]?[1-9][\d]{0,15}$/,
                    message: t('phoneInvalid') || 'Enter a valid phone number',
                  },
                ]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_person" label={t('contactPersonLabel') || 'Contact Person'}>
                <Input placeholder="Enter contact person name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label={t('statusLabel') || 'Status'}>
                <Select>
                  <Option value="active">{t('statusActive') || 'Active'}</Option>
                  <Option value="inactive">{t('statusInactive') || 'Inactive'}</Option>
                  <Option value="pending">{t('statusPending') || 'Pending'}</Option>
                </Select>
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
