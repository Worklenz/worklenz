import { Card, Table, Typography, Spin, Alert, Empty, Button, Space, Dropdown, message, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { TableProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';
import ClientPortalStatusTags from '@/components/client-portal/ClientPortalStatusTags';
import { useGetOrganizationServicesQuery, useDeleteOrganizationServiceMutation } from '../../../api/client-portal/client-portal-api';
import { PlusOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const ServicesTable = () => {
  // localization
  const { t } = useTranslation('client-portal-services');

  // Fetch services from API
  const { data: servicesData, isLoading, error } = useGetOrganizationServicesQuery({});
  const [deleteService] = useDeleteOrganizationServiceMutation();

  const navigate = useNavigate();

  // Handle edit service
  const handleEdit = (serviceId: string) => {
    navigate(`/worklenz/client-portal/edit-service/${serviceId}`);
  };

  // Handle delete service
  const handleDelete = async (serviceId: string, serviceName: string) => {
    try {
      await deleteService(serviceId).unwrap();
      message.success(t('serviceDeletedSuccessfully') || `Service "${serviceName}" deleted successfully!`);
    } catch (error) {
      console.error('Failed to delete service:', error);
      message.error(t('serviceDeleteFailed') || 'Failed to delete service. Please try again.');
    }
  };

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('nameColumn'),
      render: (record) => <Typography.Text>{record.name}</Typography.Text>,
    },
    {
      key: 'createdBy',
      title: t('createdByColumn'),
      render: (record) => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>
          {record.created_by_name || 'Unknown'}
        </Typography.Text>
      ),
    },
    {
      key: 'status',
      title: t('statusColumn'),
      render: (record) => <ClientPortalStatusTags status={record.status} />,
    },
    {
      key: 'noOfRequests',
      title: t('noOfRequestsColumn'),
      render: (record) => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>
          {record.requests_count || 0}
        </Typography.Text>
      ),
    },
    {
      key: 'actions',
      title: t('actionsColumn') || 'Actions',
      width: 100,
      align: 'center',
      render: (record) => {
        const menuItems = [
          {
            key: 'edit',
            label: t('editButton'),
            icon: <EditOutlined />,
            onClick: () => handleEdit(record.id),
          },
          {
            key: 'delete',
            label: t('deleteButton'),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: t('confirmDeleteTitle') || 'Confirm Delete',
                icon: <ExclamationCircleOutlined />,
                content: t('confirmDeleteMessage') || `Are you sure you want to delete "${record.name}"? This action cannot be undone.`,
                okText: t('deleteButton'),
                okType: 'danger',
                cancelText: t('cancelButton'),
                onOk: () => handleDelete(record.id, record.name),
              });
            },
          },
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              style={{ border: 'none' }}
            />
          </Dropdown>
        );
      },
    },
  ];

  // Handle loading state
  if (isLoading) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    const isNotImplemented = (error as any)?.status === 404;
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Alert
          message={isNotImplemented ? 'Feature Not Yet Available' : (t('errorLoadingServices') || 'Error Loading Services')}
          description={
            isNotImplemented 
              ? 'The organization services management feature is currently under development. Please check back later.'
              : (t('errorLoadingServicesDescription') || 'There was an error loading the services. Please try again later.')
          }
          type={isNotImplemented ? "info" : "error"}
          showIcon
        />
      </Card>
    );
  }

  // Extract services from API response
  // The response structure from backend: { total: number, data: Service[] }
  const servicesResponse = servicesData?.body || { total: 0, data: [] };
  const services = servicesResponse.data || [];

  // Handle empty state
  if (!services || services.length === 0) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {t('noServicesTitle')}
              </Typography.Title>
              <Typography.Text type="secondary">
                {t('noServicesDescription')}
              </Typography.Text>
            </div>
          }
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            height: 'calc(100vh - 320px)'
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/worklenz/client-portal/add-service')}
          >
            {t('addServiceButton')}
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <Card style={{ height: 'calc(100vh - 280px)' }}>
      <Table
        columns={columns}
        dataSource={services}
        pagination={{
          size: 'small',
          total: servicesResponse.total || services.length,
          current: 1, // Backend doesn't return current page info
          pageSize: 10, // Default page size
        }}
        scroll={{
          x: 'max-content',
        }}
        onRow={(record) => {
          return {
            style: { cursor: 'pointer' },
          };
        }}
      />
    </Card>
  );
};

export default ServicesTable;
