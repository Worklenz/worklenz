import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Empty,
  Flex,
  Input,
  Select,
  Table,
  TableProps,
  Tag,
  theme,
  Typography,
} from '@/shared/antd-imports';
import { ClientPortalClient, useGetClientsQuery } from '@/ee/api/client-portal/client-portal-api';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;

interface HomeClientsTableProps {
  onCreateClick?: () => void;
}

const getPortalStatus = (
  record: ClientPortalClient,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const status = record.portal_status?.status;
  if (status === 'active' || record.has_portal_access) {
    return { status: 'active', color: 'green', label: t('portalStatus.active', { ns: 'client-portal-clients', defaultValue: 'Active' }) };
  }
  if (status === 'expired') {
    return { status: 'expired', color: 'red', label: t('portalStatus.expired', { ns: 'client-portal-clients', defaultValue: 'Expired' }) };
  }
  if (status === 'invited' || (record.invitation_sent_at && !record.invitation_accepted)) {
    return { status: 'invited', color: 'orange', label: t('portalStatus.invited', { ns: 'client-portal-clients', defaultValue: 'Invited' }) };
  }
  return {
    status: 'not_invited',
    color: 'default',
    label: t('portalStatus.not_invited', { ns: 'client-portal-clients', defaultValue: 'Not Invited' }),
  };
};

const HomeClientsTable: React.FC<HomeClientsTableProps> = ({ onCreateClick }) => {
  const { t } = useTranslation(['home', 'client-portal-clients']);
  const { token } = theme.useToken();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      status: status !== 'all' ? status : undefined,
      sortBy,
      sortOrder,
    }),
    [page, limit, search, status, sortBy, sortOrder]
  );

  const { data, isFetching } = useGetClientsQuery(queryParams, { refetchOnMountOrArgChange: true });
  const clients = data?.body?.clients || [];
  const total = data?.body?.total || 0;
  const hasActiveFilters = Boolean(search) || status !== 'all';

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const handleTableChange: TableProps<ClientPortalClient>['onChange'] = (_pagination, _filters, sorter) => {
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;
    if (sort?.field && sort?.order) {
      setSortBy(sort.field as string);
      setSortOrder(sort.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  const columns: TableProps<ClientPortalClient>['columns'] = [
    {
      key: 'client',
      title: t('clientColumn', { ns: 'client-portal-clients', defaultValue: 'Client' }),
      dataIndex: 'name',
      sorter: true,
      render: (_name: string, record) => (
        <Flex vertical gap={2}>
          <Typography.Text strong>{record.company_name?.trim() || record.name}</Typography.Text>
          {record.email?.trim() && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      key: 'contact',
      title: t('contactColumn', { ns: 'client-portal-clients', defaultValue: 'Contact' }),
      dataIndex: 'contact_person',
      render: (value: string) =>
        value?.trim() ? (
          <Typography.Text>{value}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
      width: 160,
    },
    {
      key: 'portalStatus',
      title: t('portalStatusColumn', { ns: 'client-portal-clients', defaultValue: 'Portal Status' }),
      dataIndex: 'portal_status',
      render: (_, record) => {
        const portalStatus = getPortalStatus(record, t);
        return <Tag color={portalStatus.color}>{portalStatus.label}</Tag>;
      },
      width: 130,
    },
    {
      key: 'assignedProjects',
      title: t('assignedProjectsColumn', { ns: 'client-portal-clients', defaultValue: 'Assigned Projects' }),
      dataIndex: 'assigned_projects_count',
      sorter: true,
      render: (value: number) => value || 0,
      width: 140,
    },
    {
      key: 'created',
      title: t('addClient.createdColumn', { defaultValue: 'Created' }),
      dataIndex: 'created_at',
      sorter: true,
      render: (value: string) => (value ? dayjs(value).format('MMM D, YYYY') : '-'),
      width: 120,
    },
  ];

  return (
    <div
      style={{
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {t('addClient.clientsTableTitle', { defaultValue: 'Clients' })}
      </div>

      <Flex gap={10} wrap="wrap" style={{ padding: '12px 14px' }}>
        <Search
          placeholder={t('searchClientsPlaceholder', { ns: 'client-portal-clients', defaultValue: 'Search clients...' })}
          allowClear
          style={{ width: 220 }}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          onSearch={handleSearch}
        />
        <Select
          value={status}
          onChange={handleStatusChange}
          style={{ width: 170 }}
          placeholder={t('portalStatusFilterPlaceholder', { ns: 'client-portal-clients', defaultValue: 'Filter by status' })}
        >
          <Option value="all">{t('statusAll', { ns: 'client-portal-clients', defaultValue: 'All' })}</Option>
          <Option value="active">{t('portalStatus.active', { ns: 'client-portal-clients', defaultValue: 'Active' })}</Option>
          <Option value="invited">{t('portalStatus.invited', { ns: 'client-portal-clients', defaultValue: 'Invited' })}</Option>
          <Option value="not_invited">
            {t('portalStatus.not_invited', { ns: 'client-portal-clients', defaultValue: 'Not Invited' })}
          </Option>
          <Option value="expired">{t('portalStatus.expired', { ns: 'client-portal-clients', defaultValue: 'Expired' })}</Option>
        </Select>
      </Flex>

      {!isFetching && clients.length === 0 ? (
        <div style={{ padding: '24px 14px 32px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
                  {t('addClient.emptyTitle', { defaultValue: 'No clients yet' })}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {hasActiveFilters
                    ? t('noClientsMatchingFilters', {
                        ns: 'client-portal-clients',
                        defaultValue: 'No clients match the current filters.',
                      })
                    : t('addClient.emptySubtitle', {
                        defaultValue: 'Create your first client record using the form on the left.',
                      })}
                </Typography.Text>
              </div>
            }
          >
            {!hasActiveFilters && (
              <Button type="primary" size="small" onClick={onCreateClick}>
                {t('addClient.createClientButton', { defaultValue: 'Create Client' })}
              </Button>
            )}
          </Empty>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={clients}
          rowKey="id"
          size="small"
          loading={isFetching}
          onChange={handleTableChange}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setLimit(ps);
            },
          }}
        />
      )}
    </div>
  );
};

export default HomeClientsTable;
