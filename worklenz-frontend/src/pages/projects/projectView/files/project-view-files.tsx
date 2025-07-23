import {
  Button,
  Card,
  Flex,
  Popconfirm,
  Segmented,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { colors } from '@/styles/colors';
import {
  AppstoreOutlined,
  BarsOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  ExclamationCircleOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { durationDateFormat } from '@utils/durationDateFormat';
import { DEFAULT_PAGE_SIZE, IconsMap } from '@/shared/constants';
import {
  IProjectAttachmentsViewModel,
  ITaskAttachmentViewModel,
} from '@/types/tasks/task-attachment-view-model';
import { useAppSelector } from '@/hooks/useAppSelector';
import { attachmentsApiService } from '@/api/attachments/attachments.api.service';
import logger from '@/utils/errorLogger';
import { evt_project_files_visit } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

const ProjectViewFiles = () => {
  const { t } = useTranslation('project-view-files');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { projectId, refreshTimestamp } = useAppSelector(state => state.projectReducer);
  const [attachments, setAttachments] = useState<IProjectAttachmentsViewModel>({});
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [paginationConfig, setPaginationConfig] = useState({
    total: 0,
    pageIndex: 1,
    showSizeChanger: true,
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  const fetchAttachments = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const response = await attachmentsApiService.getProjectAttachments(
        projectId,
        paginationConfig.pageIndex,
        paginationConfig.defaultPageSize
      );
      if (response.done) {
        setAttachments(response.body || {});
        setPaginationConfig(prev => ({ ...prev, total: response.body?.total || 0 }));
      }
    } catch (error) {
      logger.error('Error fetching project attachments', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [refreshTimestamp]);

  const getFileTypeIcon = (type: string | undefined) => {
    if (!type) return IconsMap['search'];
    return IconsMap[type as string] || IconsMap['search'];
  };

  const downloadAttachment = async (id: string | undefined, filename: string | undefined) => {
    if (!id || !filename) return;
    try {
      setDownloading(true);

      const response = await attachmentsApiService.downloadAttachment(id, filename);

      if (response.done) {
        const link = document.createElement('a');
        link.href = response.body || '';
        link.download = filename;
        link.click();
        link.remove();
      }
    } catch (error) {
      logger.error('Error downloading attachment', error);
    } finally {
      setDownloading(false);
    }
  };

  const deleteAttachment = async (id: string | undefined) => {
    if (!id) return;
    try {
      const response = await attachmentsApiService.deleteAttachment(id);
      if (response.done) {
        fetchAttachments();
      }
    } catch (error) {
      logger.error('Error deleting attachment', error);
    }
  };

  const openAttachment = (url: string | undefined) => {
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.style.display = 'none';
    a.click();
  };

  useEffect(() => {
    trackMixpanelEvent(evt_project_files_visit);
    fetchAttachments();
  }, [paginationConfig.pageIndex, projectId]);

  const columns: TableProps<ITaskAttachmentViewModel>['columns'] = [
    {
      key: 'fileName',
      title: t('nameColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Flex
          gap={4}
          align="center"
          style={{ cursor: 'pointer' }}
          onClick={() => openAttachment(record.url)}
        >
          <img
            src={`/file-types/${getFileTypeIcon(record.type)}`}
            alt={t('fileIconAlt')}
            style={{ width: '100%', maxWidth: 25 }}
          />
          <Typography.Text>
            [{record.task_key}] {record.name}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'attachedTask',
      title: t('attachedTaskColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Typography.Text style={{ cursor: 'pointer' }} onClick={() => openAttachment(record.url)}>
          {record.task_name}
        </Typography.Text>
      ),
    },
    {
      key: 'size',
      title: t('sizeColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Typography.Text style={{ cursor: 'pointer' }} onClick={() => openAttachment(record.url)}>
          {record.size}
        </Typography.Text>
      ),
    },
    {
      key: 'uploadedBy',
      title: t('uploadedByColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Typography.Text style={{ cursor: 'pointer' }} onClick={() => openAttachment(record.url)}>
          {record.uploader_name}
        </Typography.Text>
      ),
    },
    {
      key: 'uploadedAt',
      title: t('uploadedAtColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Typography.Text style={{ cursor: 'pointer' }} onClick={() => openAttachment(record.url)}>
          <Tooltip title={record.created_at}>{durationDateFormat(record.created_at)}</Tooltip>
        </Typography.Text>
      ),
    },
    {
      key: 'actionBtns',
      width: 80,
      render: (record: ITaskAttachmentViewModel) => (
        <Flex gap={8} style={{ padding: 0 }}>
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={() => deleteAttachment(record.id)}
          >
            <Tooltip title="Delete">
              <Button shape="default" icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>

          <Tooltip title="Download">
            <Button
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => downloadAttachment(record.id, record.name)}
              loading={downloading}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="space-between">
          <Typography.Text
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              color: colors.lightGray,
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            <ExclamationCircleOutlined />
            {t('titleDescriptionText')}
          </Typography.Text>

          <Tooltip title={t('segmentedTooltip')}>
            <Segmented
              options={[
                { value: 'listView', icon: <BarsOutlined /> },
                { value: 'thumbnailView', icon: <AppstoreOutlined /> },
              ]}
              defaultValue={'listView'}
              disabled={true}
            />
          </Tooltip>
        </Flex>
      }
    >
      <Table<ITaskAttachmentViewModel>
        className="custom-two-colors-row-table"
        dataSource={attachments.data}
        columns={columns}
        rowKey={record => record.id || ''}
        loading={loading}
        pagination={{
          showSizeChanger: paginationConfig.showSizeChanger,
          defaultPageSize: paginationConfig.defaultPageSize,
          total: paginationConfig.total,
          current: paginationConfig.pageIndex,
          onChange: (page, pageSize) =>
            setPaginationConfig(prev => ({
              ...prev,
              pageIndex: page,
              defaultPageSize: pageSize,
            })),
        }}
      />
    </Card>
  );
};

export default ProjectViewFiles;
