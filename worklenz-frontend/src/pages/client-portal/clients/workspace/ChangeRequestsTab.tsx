import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { Typography } from '@/shared/antd-imports';
import { useGetChangeRequestsQuery } from '@/api/client-portal/portal-workflow-api';
import {
  ChangeRequestStatusTag,
  PortalPagedTable,
  PriorityTag,
  formatPortalDate,
  usePortalPaging,
} from '@/components/client-portal/v2';
import type { ChangeRequest } from '@/types/client-portal/v2';
import { portalPaths } from '../../portal-paths';

interface ChangeRequestsTabProps {
  organizationId: string;
  organizationName: string;
}

/** Change requests this client has submitted. Requests come from the client, so there is no "new" button. */
export const ChangeRequestsTab = ({ organizationId, organizationName }: ChangeRequestsTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-clients');
  const navigate = useNavigate();
  const paging = usePortalPaging();
  const query = useGetChangeRequestsQuery({
    organization_id: organizationId,
    page: paging.page,
    limit: paging.limit,
  });
  const list = query.data?.body;

  const columns: ColumnsType<ChangeRequest> = [
    {
      key: 'ref',
      title: t('workspace.changeRequests.columns.id', { defaultValue: 'ID' }),
      render: (_value, request) => <Typography.Link>{request.cr_no}</Typography.Link>,
    },
    {
      key: 'title',
      title: t('workspace.changeRequests.columns.title', { defaultValue: 'Title' }),
      dataIndex: 'title',
    },
    {
      key: 'priority',
      title: t('workspace.changeRequests.columns.priority', { defaultValue: 'Priority' }),
      render: (_value, request) => <PriorityTag priority={request.priority} />,
    },
    {
      key: 'submitted',
      title: t('workspace.changeRequests.columns.submitted', { defaultValue: 'Submitted' }),
      render: (_value, request) => formatPortalDate(request.submitted_at, i18n.language) ?? '—',
    },
    {
      key: 'status',
      title: t('workspace.changeRequests.columns.status', { defaultValue: 'Status' }),
      render: (_value, request) => <ChangeRequestStatusTag status={request.status} />,
    },
  ];

  return (
    <PortalPagedTable<ChangeRequest>
      ariaLabel={t('workspace.changeRequests.tableLabel', { defaultValue: 'Change requests from this client' })}
      columns={columns}
      rows={list?.items ?? []}
      rowKey={request => request.id}
      total={list?.total ?? 0}
      paging={paging}
      loading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      onRowClick={request => navigate(portalPaths.changeRequest(request.id))}
      emptyText={t('workspace.changeRequests.empty', {
        name: organizationName,
        defaultValue: 'No change requests from {{name}} yet.',
      })}
    />
  );
};
