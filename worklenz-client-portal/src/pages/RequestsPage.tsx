import React, { useState } from 'react';
import { Card, Typography, Table, Tag, Button, Flex, Empty, Spin, Alert } from '@/shared/antd-imports';
import { EyeOutlined, PlusOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetRequestsQuery } from '@/store/api';
import { useNavigate } from 'react-router-dom';
import { ClientRequest } from '@/types';

const { Title, Paragraph } = Typography;

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
      case 'pending': return 'orange';
      case 'accepted': return 'blue';
      case 'in_progress': return 'processing';
      case 'completed': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: t('requests.requestNo'),
      dataIndex: 'req_no',
      key: 'req_no',
      width: 140,
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
        <Tag color={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
        </Tag>
      ),
    },
    {
      title: t('requests.created'),
      dataIndex: 'time',
      key: 'time',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: t('requests.action'),
      key: 'action',
      width: 100,
      render: (record: ClientRequest) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/requests/${record.id}`)}
        >
          {t('requests.view')}
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <Flex vertical gap={24} style={{ width: '100%' }}>
        <Flex vertical gap={8}>
          <Title level={1} style={{ margin: 0 }}>{t('requests.title')}</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {t('requests.description')}
          </Paragraph>
        </Flex>
        
        <Card>
          <Alert
            message={t('requests.errorLoading')}
            description={t('requests.errorLoadingDescription')}
            type="error"
            showIcon
          />
        </Card>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <Flex vertical gap={8}>
          <Title level={1} style={{ margin: 0 }}>{t('requests.title')}</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {t('requests.description')}
          </Paragraph>
        </Flex>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/requests/new')}
        >
          {t('requests.newRequest')}
        </Button>
      </Flex>
      
      <Card>
      
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
              showQuickJumper: true,
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
          />
        ) : (
          <Empty
            description={t('requests.noRequests')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/requests/new')}
            >
              {t('requests.createFirst')}
            </Button>
          </Empty>
        )}
      </Spin>
      </Card>
    </Flex>
  );
};

export default RequestsPage; 