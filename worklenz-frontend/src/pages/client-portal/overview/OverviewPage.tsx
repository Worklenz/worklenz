import { useTranslation } from 'react-i18next';
import { Alert, Button, Empty, Flex, Skeleton, Typography } from '@/shared/antd-imports';
import { useGetOverviewQuery } from '@/api/client-portal/portal-overview-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { OverviewGrid } from './OverviewGrid';
import { OverviewToolbar } from './OverviewToolbar';
import { visibleKeys } from './overview-layout';
import { useOverviewLayout } from './useOverviewLayout';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import { OVERVIEW_NS } from './widgets/WidgetFrame';

const REFRESH_MS = 60_000;

export const OverviewPage = () => {
  const { t } = useTranslation(OVERVIEW_NS);
  const layout = useOverviewLayout();
  useUnsavedChangesGuard(layout.isDirty, layout.cancel);

  // Only visible widgets are requested, so hiding one stops its queries. Wait for the layout so the first request is right.
  const overviewQuery = useGetOverviewQuery(
    { widgets: visibleKeys(layout.widgets) },
    { skip: layout.isLoading, pollingInterval: REFRESH_MS, refetchOnMountOrArgChange: true }
  );

  const hasVisibleWidgets = layout.widgets.some(widget => !widget.hidden);

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t('page.title', { defaultValue: 'Overview' })}
          </Typography.Title>
          <Typography.Text type="secondary">
            {layout.isEditing
              ? t('page.editingHint', {
                  defaultValue: 'Drag widgets to move them, resize from the corner, or hide the ones you do not need.',
                })
              : t('page.description', {
                  defaultValue: 'What needs your attention across clients, projects and discussions.',
                })}
          </Typography.Text>
        </div>
        <OverviewToolbar layout={layout} />
      </Flex>

      {layout.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          {overviewQuery.isError && !overviewQuery.data && (
            <Alert
              type="error"
              showIcon
              message={getPortalErrorMessage(
                overviewQuery.error,
                t('page.loadFailed', { defaultValue: 'The overview could not be loaded.' })
              )}
              action={
                <Button size="small" onClick={() => overviewQuery.refetch()}>
                  {t('widget.retry', { defaultValue: 'Retry' })}
                </Button>
              }
            />
          )}
          {hasVisibleWidgets ? (
            <OverviewGrid
              layout={layout}
              data={overviewQuery.data?.body}
              isFetching={overviewQuery.isFetching}
              onRetry={() => overviewQuery.refetch()}
            />
          ) : (
            <Empty
              description={
                <>
                  <Typography.Text strong>
                    {t('edit.emptyTitle', { defaultValue: 'No widgets on your overview' })}
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary">
                    {t('edit.emptyHelp', { defaultValue: 'Choose Customize, then Add widget to bring some back.' })}
                  </Typography.Text>
                </>
              }
            />
          )}
        </>
      )}
    </Flex>
  );
};

export default OverviewPage;
