import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Empty, Flex, Timeline, theme } from '@/shared/antd-imports';
import { useGetAuditLogQuery } from '@/api/client-portal/portal-workflow-api';
import { StatusTag, formatPortalDateTime, usePortalPaging } from '@/components/client-portal/v2';
import TablePagination from '@/components/TablePagination';
import { portalPaths } from '../../portal-paths';
import { PortalLoader } from '@/components/client-portal/v2';

interface ActivityTabProps {
  organizationId: string;
  organizationName: string;
}

/** The audit trail for this client, with a link to the full log filtered to them. */
export const ActivityTab = ({ organizationId, organizationName }: ActivityTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-clients');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const paging = usePortalPaging();
  const query = useGetAuditLogQuery({ organization_id: organizationId, page: paging.page, limit: paging.limit });
  const list = query.data?.body;

  const renderBody = () => {
    if (query.isLoading) return <PortalLoader />;
    if (query.isError) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('workspace.activity.error', { defaultValue: 'The activity could not be loaded.' })}
          action={
            <Button size="small" onClick={() => query.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }
    if (!list || list.items.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('workspace.activity.empty', {
            name: organizationName,
            defaultValue: 'No activity for {{name}} yet.',
          })}
        />
      );
    }
    return (
      <>
        <Timeline
          items={list.items.map(event => ({
            key: event.id,
            children: (
              <div>
                <Flex align="center" gap={6} wrap="wrap" style={{ fontSize: 13 }}>
                  <strong>{event.actor}</strong>
                  <StatusTag tone={event.side === 'client' ? 'purple' : 'gray'}>
                    {event.side === 'client'
                      ? t('workspace.activity.sideClient', { defaultValue: 'Client' })
                      : t('workspace.activity.sideInternal', { defaultValue: 'Internal' })}
                  </StatusTag>
                  <span>· {event.event}</span>
                </Flex>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{event.target}</div>
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {formatPortalDateTime(event.at, i18n.language)}
                </div>
              </div>
            ),
          }))}
        />
        <TablePagination
          navigationLabel={t('common:paginationNavigation')}
          firstPageLabel={t('common:firstPage')}
          previousPageLabel={t('common:previousPage')}
          nextPageLabel={t('common:nextPage')}
          lastPageLabel={t('common:lastPage')}
          renderDefaultSummary={(range, total) => t('common:paginationSummary', { range, total })}
          page={paging.page}
          pageSize={paging.limit}
          total={list.total}
          onPageChange={(page, pageSize) => paging.setPage(page, pageSize)}
          rowsPerPageLabel={t('rowsPerPage', { defaultValue: 'Rows per page:' })}
        />
      </>
    );
  };

  return (
    <Card
      size="small"
      title={t('workspace.activity.title', {
        name: organizationName,
        defaultValue: 'Audit trail for {{name}}',
      })}
      extra={
        <Button size="small" onClick={() => navigate(portalPaths.audit(organizationId))}>
          {t('workspace.activity.openFullLog', { defaultValue: 'Open full audit log' })}
        </Button>
      }
    >
      {renderBody()}
    </Card>
  );
};
