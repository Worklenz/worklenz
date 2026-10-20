import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Button, Flex, Typography } from '@/shared/antd-imports';
import { useGetApprovalsQuery } from '@/api/client-portal/portal-workflow-api';
import {
  ApprovalStatusTag,
  PortalPagedTable,
  formatPortalDate,
  isBeforeToday,
  usePortalPaging,
} from '@/components/client-portal/v2';
import type { Approval } from '@/types/client-portal/v2';
import { portalPaths } from '../../portal-paths';

interface ApprovalsTabProps {
  organizationId: string;
  organizationName: string;
}

/** Approvals asked of this client, with a shortcut to request a new one. */
export const ApprovalsTab = ({ organizationId, organizationName }: ApprovalsTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-clients');
  const navigate = useNavigate();
  const paging = usePortalPaging();
  const query = useGetApprovalsQuery({
    organization_id: organizationId,
    page: paging.page,
    limit: paging.limit,
  });
  const list = query.data?.body;

  const columns: ColumnsType<Approval> = [
    {
      key: 'ref',
      title: t('workspace.approvals.columns.id', { defaultValue: 'ID' }),
      render: (_value, approval) => <Typography.Link>{approval.ref_no}</Typography.Link>,
    },
    {
      key: 'title',
      title: t('workspace.approvals.columns.title', { defaultValue: 'Title' }),
      dataIndex: 'title',
    },
    {
      key: 'linked',
      title: t('workspace.approvals.columns.linked', { defaultValue: 'Linked item' }),
      render: (_value, approval) => (
        <Typography.Text type="secondary">
          {approval.linked_item.name}
          {approval.linked_item.file_version ? ` · v${approval.linked_item.file_version}` : ''}
        </Typography.Text>
      ),
    },
    {
      key: 'due',
      title: t('workspace.approvals.columns.due', { defaultValue: 'Due' }),
      render: (_value, approval) => {
        const due = formatPortalDate(approval.due_date, i18n.language);
        return due ? (
          <Typography.Text type={approval.status === 'awaiting' && isBeforeToday(approval.due_date) ? 'danger' : undefined}>
            {due}
          </Typography.Text>
        ) : (
          '—'
        );
      },
    },
    {
      key: 'status',
      title: t('workspace.approvals.columns.status', { defaultValue: 'Status' }),
      render: (_value, approval) => <ApprovalStatusTag status={approval.status} />,
    },
  ];

  return (
    <div>
      <Flex justify="flex-end" style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => navigate(portalPaths.newApproval({ organizationId }))}
        >
          {t('workspace.approvals.request', { defaultValue: 'Request approval' })}
        </Button>
      </Flex>
      <PortalPagedTable<Approval>
        ariaLabel={t('workspace.approvals.tableLabel', { defaultValue: 'Approvals for this client' })}
        columns={columns}
        rows={list?.items ?? []}
        rowKey={approval => approval.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={approval => navigate(portalPaths.approval(approval.id))}
        emptyText={t('workspace.approvals.empty', {
          name: organizationName,
          defaultValue: 'No approvals for {{name}} yet.',
        })}
      />
    </div>
  );
};
