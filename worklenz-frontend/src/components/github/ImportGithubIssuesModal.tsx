import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Empty,
  Flex,
  Modal,
  Segmented,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from '@/shared/antd-imports';
import {
  githubApiService,
  IGithubIssueSummary,
  IGithubSprint,
} from '@/api/github/github.api.service';
import logger from '@/utils/errorLogger';

type IssueStateFilter = 'open' | 'closed' | 'all';

interface ImportGithubIssuesModalProps {
  open: boolean;
  projectId: string;
  linkId: string;
  repositoryName: string;
  sprints: IGithubSprint[];
  onClose: () => void;
  onImported: () => void;
}

const BACKLOG_VALUE = '__backlog__';
const MAX_IMPORT = 50;

/** Pick GitHub issues and add them to the backlog or a sprint. */
export const ImportGithubIssuesModal = ({
  open,
  projectId,
  linkId,
  repositoryName,
  sprints,
  onClose,
  onImported,
}: ImportGithubIssuesModalProps) => {
  const { t } = useTranslation('github-integration');
  const [messageApi, contextHolder] = message.useMessage();

  const [stateFilter, setStateFilter] = useState<IssueStateFilter>('open');
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const [issues, setIssues] = useState<IGithubIssueSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [destination, setDestination] = useState<string>(BACKLOG_VALUE);
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const response = await githubApiService.getRepositoryIssues(projectId, linkId, {
          state: stateFilter,
          labels: labelFilter,
          page: nextPage,
        });
        setIssues(previous =>
          replace ? response.body.issues : [...previous, ...response.body.issues]
        );
        setHasMore(response.body.has_more);
        setPage(nextPage);
      } catch (error) {
        logger.error('Failed to load GitHub issues', error);
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, linkId, stateFilter, labelFilter]
  );

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    void load(1, true);
  }, [open, load]);

  useEffect(() => {
    if (open) {
      setDestination(BACKLOG_VALUE);
      setStateFilter('open');
      setLabelFilter([]);
    }
  }, [open]);

  const handleImport = async () => {
    if (!selected.length) return;
    setIsImporting(true);
    try {
      const response = await githubApiService.importIssues(projectId, linkId, {
        numbers: selected,
        phase_id: destination === BACKLOG_VALUE ? null : destination,
      });
      const { imported, skipped } = response.body;
      if (skipped.length === 0) {
        messageApi.success(
          t('import.success', {
            defaultValue: 'Imported {{count}} issues.',
            count: imported.length,
          })
        );
      } else {
        messageApi.warning(
          t('import.partial', {
            defaultValue: '{{imported}} imported, {{skipped}} skipped.',
            imported: imported.length,
            skipped: skipped.length,
          })
        );
      }
      if (imported.length) onImported();
      setSelected([]);
      await load(1, true);
    } catch (error) {
      logger.error('Failed to import GitHub issues', error);
      messageApi.error(
        t('import.failed', { defaultValue: 'Could not import the selected issues.' })
      );
    } finally {
      setIsImporting(false);
    }
  };

  const destinationOptions = useMemo(
    () => [
      { value: BACKLOG_VALUE, label: t('import.backlog', { defaultValue: 'Backlog' }) },
      ...sprints.map(sprint => ({ value: sprint.id, label: sprint.name })),
    ],
    [sprints, t]
  );

  const labelOptions = useMemo(
    () =>
      [...new Set(issues.flatMap(issue => issue.labels))].map(label => ({
        value: label,
        label,
      })),
    [issues]
  );

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        onCancel={onClose}
        width={760}
        destroyOnHidden
        title={t('import.title', {
          defaultValue: 'Import issues from {{name}}',
          name: repositoryName,
        })}
        footer={
          <Flex justify="space-between" align="center" gap={12} wrap>
            <Flex align="center" gap={8}>
              <Typography.Text type="secondary">
                {t('import.destination', { defaultValue: 'Add to' })}
              </Typography.Text>
              <Select
                style={{ minWidth: 180 }}
                value={destination}
                options={destinationOptions}
                onChange={setDestination}
                aria-label={t('import.destination', { defaultValue: 'Add to' })}
              />
            </Flex>
            <Flex gap={8}>
              <Button onClick={onClose}>{t('actions.cancel', { defaultValue: 'Cancel' })}</Button>
              <Button
                type="primary"
                disabled={!selected.length}
                loading={isImporting}
                onClick={() => void handleImport()}
              >
                {t('import.submit', {
                  defaultValue: 'Import {{count}} issues',
                  count: selected.length,
                })}
              </Button>
            </Flex>
          </Flex>
        }
      >
        <Flex vertical gap={12}>
          <Flex gap={12} wrap align="center">
            <Segmented<IssueStateFilter>
              value={stateFilter}
              onChange={setStateFilter}
              options={[
                { value: 'open', label: t('import.stateOpen', { defaultValue: 'Open' }) },
                { value: 'closed', label: t('import.stateClosed', { defaultValue: 'Closed' }) },
                { value: 'all', label: t('import.stateAll', { defaultValue: 'All' }) },
              ]}
            />
            <Select
              mode="tags"
              style={{ flex: 1, minWidth: 220 }}
              value={labelFilter}
              onChange={setLabelFilter}
              options={labelOptions}
              tokenSeparators={[',']}
              placeholder={t('import.filterLabels', { defaultValue: 'Filter by label' })}
              aria-label={t('import.filterLabels', { defaultValue: 'Filter by label' })}
            />
          </Flex>

          {loadFailed && (
            <Alert
              type="error"
              showIcon
              message={t('import.loadFailed', { defaultValue: 'Could not load GitHub issues.' })}
              action={
                <Button size="small" onClick={() => void load(1, true)}>
                  {t('actions.retry', { defaultValue: 'Retry' })}
                </Button>
              }
            />
          )}

          <Table<IGithubIssueSummary>
            size="small"
            rowKey="number"
            loading={isLoading && issues.length === 0}
            dataSource={issues}
            pagination={false}
            scroll={{ y: 360 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('import.empty', { defaultValue: 'No issues found' })}
                />
              ),
            }}
            rowSelection={{
              selectedRowKeys: selected,
              onChange: keys => setSelected((keys as number[]).slice(0, MAX_IMPORT)),
              getCheckboxProps: issue => ({
                disabled: !!issue.imported_task_key,
                'aria-label': `#${issue.number}`,
              }),
            }}
            columns={[
              {
                title: '#',
                dataIndex: 'number',
                width: 70,
                render: (number: number) => (
                  <Typography.Text type="secondary">#{number}</Typography.Text>
                ),
              },
              {
                title: t('import.columnTitle', { defaultValue: 'Title' }),
                dataIndex: 'title',
                render: (_: string, issue) => (
                  <Flex vertical gap={4}>
                    <Typography.Link
                      href={issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {issue.title}
                    </Typography.Link>
                    {issue.labels.length > 0 && (
                      <Flex gap={4} wrap>
                        {issue.labels.map(label => (
                          <Tag key={label} style={{ margin: 0 }}>
                            {label}
                          </Tag>
                        ))}
                      </Flex>
                    )}
                  </Flex>
                ),
              },
              {
                title: t('import.columnStatus', { defaultValue: 'Status' }),
                width: 150,
                render: (_: unknown, issue) =>
                  issue.imported_task_key ? (
                    <Tag color="success">
                      {t('import.imported', {
                        defaultValue: 'Imported as {{key}}',
                        key: issue.imported_task_key,
                      })}
                    </Tag>
                  ) : (
                    <Tag color={issue.state === 'open' ? 'processing' : 'default'}>
                      {issue.state === 'open'
                        ? t('import.stateOpen', { defaultValue: 'Open' })
                        : t('import.stateClosed', { defaultValue: 'Closed' })}
                    </Tag>
                  ),
              },
            ]}
          />

          {hasMore && (
            <Button loading={isLoading} onClick={() => void load(page + 1, false)}>
              {t('import.loadMore', { defaultValue: 'Load more' })}
            </Button>
          )}
        </Flex>
      </Modal>
    </>
  );
};

export default ImportGithubIssuesModal;
