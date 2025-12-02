import React, { useState } from 'react';
import { Card, Typography, Table, Tag, Button, Empty, Spin, Alert, Space } from '@/shared/antd-imports';
import { EyeOutlined, PlusOutlined, FileTextOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetRequestsQuery } from '@/store/api';
import { useNavigate } from 'react-router-dom';
import { ClientRequest } from '@/types';

const { Title, Text } = Typography;

const RequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const { data, isLoading, error } = useGetRequestsQuery({
    page,
    limit: pageSize
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'accepted': return 'processing';
      case 'in_progress': return 'processing';
      case 'completed': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  const columns = [
    {
      title: t('requests.requestNo'),
      dataIndex: 'req_no',
      key: 'req_no',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('requests.service'),
      dataIndex: 'service',
      key: 'service',
      ellipsis: true,
    },
    {
      title: t('requests.requestTitle'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: t('requests.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{formatStatus(status)}</Tag>
      ),
    },
    {
      title: t('requests.created'),
      dataIndex: 'time',
      key: 'time',
      width: 110,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_: unknown, record: ClientRequest) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/requests/${record.id}`)}
        />
      ),
    },
  ];

  if (error) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 4 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            {t('requests.title')}
          </Title>
          <Text type="secondary">{t('requests.description')}</Text>
        </div>
        <Alert
          message={t('requests.errorLoading')}
          description={t('requests.errorLoadingDescription')}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            {t('requests.title')}
          </Title>
          <Text type="secondary">{t('requests.description')}</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/requests/new')}
        >
          {t('requests.newRequest')}
        </Button>
      </div>
      
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Spin spinning={isLoading}>
          {data?.body?.data && data.body.data.length > 0 ? (
            <Table
              columns={columns}
              dataSource={data.body.data}
              pagination={{
                current: page,
                pageSize: pageSize,
                total: data.body.total,
                showSizeChanger: true,
                size: 'small',
                showTotal: (total: number, range: [number, number]) =>
                  t('requests.showingRange', { start: range[0], end: range[1], total }),
                onChange: (newPage: number, newPageSize: number) => {
                  setPage(newPage);
                  setPageSize(newPageSize);
                },
              }}
              rowKey="id"
              scroll={{ x: 600 }}
              size="small"
              onRow={(record) => ({
                onClick: () => navigate(`/requests/${record.id}`),
                style: { cursor: 'pointer' },
              })}
            />
          ) : (
            <div style={{ padding: 48 }}>
              <Empty
                description={t('requests.noRequests')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/requests/new')}
                  >
                    {t('requests.createFirst')}
                  </Button>
                </Space>
              </Empty>
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default RequestsPage;