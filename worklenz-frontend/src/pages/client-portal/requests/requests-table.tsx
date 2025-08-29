import { Card, Table, Typography, Spin, Alert, Empty } from '@/shared/antd-imports';
import { TableProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import ClientPortalStatusTags from '@/components/client-portal/ClientPortalStatusTags';
import { useNavigate } from 'react-router-dom';
import { setSelectedRequestNo } from '../../../features/clients-portal/requests/requests-slice';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useGetRequestsQuery } from '../../../api/client-portal/client-portal-api';

const RequestsTable = () => {
  // localization
  const { t } = useTranslation('client-portal-requests');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Fetch requests from API
  const { data: requestsData, isLoading, error } = useGetRequestsQuery();

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'requestNumber',
      title: t('reqNoColumn'),
      render: record => <Typography.Text>{record.requestNumber}</Typography.Text>,
    },
    {
      key: 'serviceName',
      title: t('serviceColumn'),
      render: record => <Typography.Text>{record.serviceName}</Typography.Text>,
    },
    {
      key: 'clientName',
      title: t('clientColumn'),
      render: record => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>
          {record.clientName}
        </Typography.Text>
      ),
    },
    {
      key: 'status',
      title: t('statusColumn'),
      render: record => <ClientPortalStatusTags status={record.status} />,
    },
    {
      key: 'createdAt',
      title: t('timeColumn'),
      render: record => (
        <Typography.Text>{durationDateFormat(new Date(record.createdAt))}</Typography.Text>
      ),
    },
  ];

  // Handle loading state
  if (isLoading) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
          }}
        >
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Alert
          message={t('errorLoadingRequests')}
          description={t('errorLoadingRequestsDescription')}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  // Extract requests from API response - backend returns IServerResponse with {total, data} structure
  const requestsResponse = requestsData?.body || { total: 0, data: [] };
  const requests = requestsResponse.data || [];

  // Handle empty state
  if (!requests || requests.length === 0) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {t('noRequestsTitle')}
              </Typography.Title>
              <Typography.Text type="secondary">{t('noRequestsDescription')}</Typography.Text>
            </div>
          }
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: 'calc(100vh - 320px)',
          }}
        />
      </Card>
    );
  }

  return (
    <Card style={{ height: 'calc(100vh - 280px)' }}>
      <Table
        columns={columns}
        dataSource={requests}
        pagination={{
          size: 'small',
          total: requestsResponse.total || requests.length,
          current: 1, // Backend doesn't return current page info
          pageSize: 10, // Default page size
        }}
        scroll={{
          x: 'max-content',
        }}
        onRow={record => {
          return {
            onClick: () => {
              dispatch(setSelectedRequestNo(record.requestNumber));
              navigate(`/worklenz/client-portal/requests/${record.id}`);
            },
            style: { cursor: 'pointer' },
          };
        }}
      />
    </Card>
  );
};

export default RequestsTable;
