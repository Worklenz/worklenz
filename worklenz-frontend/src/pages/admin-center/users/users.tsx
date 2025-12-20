import { SearchOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { Button, Card, Flex, Input, Table, TableProps, Tooltip, Typography, Tag, Modal, message, Space } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IOrganizationUser } from '@/types/admin-center/admin-center.types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_users_visit } from '@/shared/worklenz-analytics-events';

const Users: React.FC = () => {
  const { t } = useTranslation('admin-center/users');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<IOrganizationUser[]>([]);
  const [requestParams, setRequestParams] = useState({
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: 'name',
    order: 'desc',
    searchTerm: '',
  });

  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await adminCenterApiService.getOrganizationUsers(requestParams);
      if (res.done) {
        setUsers(res.body.data ?? []);
        setRequestParams(prev => ({ ...prev, total: res.body.total ?? 0 }));
      }
    } catch (error) {
      logger.error('Error fetching users', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (email: string) => {
    try {
      const res = await adminCenterApiService.approveUser(email);
      if (res.done) {
        message.success(t('approveSuccess'));
        fetchUsers();
      } else {
        message.error(res.message || t('approveError'));
      }
    } catch (error) {
      logger.error('Error approving user', error);
      message.error(t('approveError'));
    }
  };

  const handleReject = (email: string) => {
    let reason = '';
    Modal.confirm({
      title: t('rejectTitle'),
      icon: <ExclamationCircleOutlined />,
      content: (
        <Input.TextArea
          placeholder={t('rejectReasonPlaceholder')}
          onChange={e => (reason = e.target.value)}
          style={{ marginTop: 16 }}
        />
      ),
      onOk: async () => {
        try {
          const res = await adminCenterApiService.rejectUser(email, reason);
          if (res.done) {
            message.success(t('rejectSuccess'));
            fetchUsers();
          } else {
            message.error(res.message || t('rejectError'));
          }
        } catch (error) {
          logger.error('Error rejecting user', error);
          message.error(t('rejectError'));
        }
      },
    });
  };

  const columns: TableProps<IOrganizationUser>['columns'] = [
    {
      title: t('user'),
      dataIndex: 'user',
      key: 'user',
      render: (_, record) => (
        <Flex gap={8} align="center">
          <SingleAvatar avatarUrl={record.avatar_url} name={record.name} />
          <Typography.Text>{record.name}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: t('email'),
      dataIndex: 'email',
      key: 'email',
      render: text => (
        <span className="email-hover">
          <Typography.Text copyable={{ text }}>{text}</Typography.Text>
        </span>
      ),
    },
    {
      title: t('lastActivity'),
      dataIndex: 'last_logged',
      key: 'last_logged',
      render: text => <span>{formatDateTimeWithLocale(text) || '-'}</span>,
    },
    {
      title: t('status'),
      dataIndex: 'account_status',
      key: 'account_status',
      render: (status, record) => {
        let color = 'default';
        let text = status || 'pending';

        if (status === 'approved') color = 'success';
        if (status === 'rejected') color = 'error';
        if (status === 'pending') color = 'processing';

        return (
          <Tooltip
            title={
              status === 'approved'
                ? `${t('approvedAt')}: ${formatDateTimeWithLocale(record.approved_at || '')}`
                : status === 'rejected'
                  ? `${t('rejectedAt')}: ${formatDateTimeWithLocale(record.rejected_at || '')}${record.rejection_reason ? ` - ${record.rejection_reason}` : ''
                  }`
                  : t('awaitingApproval')
            }
          >
            <Tag color={color}>{t(text)}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.account_status !== 'approved' && (
            <Tooltip title={t('approve')}>
              <Button
                type="text"
                icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                onClick={() => handleApprove(record.email || '')}
              />
            </Tooltip>
          )}
          {record.account_status !== 'rejected' && (
            <Tooltip title={t('reject')}>
              <Button
                type="text"
                icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                onClick={() => handleReject(record.email || '')}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_users_visit);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    fetchUsers();
  }, [requestParams.searchTerm, requestParams.page, requestParams.pageSize]);

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title={<span>{t('title')}</span>} style={{ padding: '16px 0' }} />
      <PageHeader
        style={{
          paddingLeft: 0,
          paddingTop: 0,
          paddingBottom: '16px',
        }}
        subTitle={
          <span
            style={{
              color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
              fontWeight: 500,
              fontSize: '16px',
            }}
          >
            {requestParams.total} {t('subTitle')}
          </span>
        }
        extra={
          <Flex gap={8} align="center">
            <Tooltip title={t('refresh')}>
              <Button
                shape="circle"
                icon={<SyncOutlined spin={isLoading} />}
                onClick={() => fetchUsers()}
              />
            </Tooltip>
            <Input
              placeholder={t('placeholder')}
              suffix={<SearchOutlined />}
              type="text"
              value={requestParams.searchTerm}
              onChange={e => setRequestParams(prev => ({ ...prev, searchTerm: e.target.value }))}
            />
          </Flex>
        }
      />
      <Card>
        <Table
          rowClassName="users-table-row"
          size="small"
          columns={columns}
          dataSource={users}
          pagination={{
            defaultPageSize: DEFAULT_PAGE_SIZE,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            size: 'small',
            showSizeChanger: true,
            total: requestParams.total,
            onChange: (page, pageSize) => setRequestParams(prev => ({ ...prev, page, pageSize })),
          }}
          loading={isLoading}
        />
      </Card>
    </div>
  );
};

export default Users;
