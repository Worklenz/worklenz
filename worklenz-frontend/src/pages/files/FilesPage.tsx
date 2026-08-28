import React from 'react';
import { createPortal } from 'react-dom';
import {
  Typography,
  Flex,
  Input,
  Button,
  Space,
  message,
  SearchOutlined,
  ImportOutlined,
  PlusOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import PillToggle from '@/pages/home/PillToggle';
import teamFilesApiService, {
  ITeamProjectFileRow,
  ITeamTaskAttachmentRow,
  ITeamProjectLinkRow,
} from '@/api/files/team-files.api.service';
import projectFilesApiService from '@/api/projects/project-files.api.service';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import projectLinksApiService from '@/api/projects/project-links.api.service';
import type { ICreateLinkBody, IUpdateLinkBody } from '@/types/projects/project-links.types';

import { FilesFilters, FilesFiltersValue } from '@/components/files/FilesFilters';
import { FilesTable, FilesTableMode } from '@/components/files/FilesTable';
import { UploadFilesModal } from '@/components/files/UploadFilesModal';
import { AddTeamLinkModal } from '@/components/files/AddTeamLinkModal';
import { FilePreviewModal } from '@/components/common/FilePreviewModal';
import TaskDrawer from '@components/task-drawer/task-drawer';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import logger from '@/utils/errorLogger';

const { Title } = Typography;

interface PageState<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
}

const initialPageState = <T,>(): PageState<T> => ({
  data: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  loading: false,
});

const FilesPage: React.FC = () => {
  const { t } = useTranslation('team-files');
  const dispatch = useAppDispatch();

  const [activeTab, setActiveTab] = React.useState<FilesTableMode>('project');
  const [searchValue, setSearchValue] = React.useState('');
  const [filters, setFilters] = React.useState<FilesFiltersValue>({});

  const [projectFilesState, setProjectFilesState] = React.useState<PageState<ITeamProjectFileRow>>(
    initialPageState()
  );
  const [taskAttachmentsState, setTaskAttachmentsState] = React.useState<PageState<ITeamTaskAttachmentRow>>(
    initialPageState()
  );
  const [linksState, setLinksState] = React.useState<PageState<ITeamProjectLinkRow>>(initialPageState());

  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [linkModalLoading, setLinkModalLoading] = React.useState(false);
  const [editingLink, setEditingLink] = React.useState<ITeamProjectLinkRow | null>(null);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewName, setPreviewName] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewDownloadFn, setPreviewDownloadFn] = React.useState<(() => void) | null>(null);

  const fetchProjectFiles = React.useCallback(
    async (page: number, pageSize: number) => {
      setProjectFilesState(prev => ({ ...prev, loading: true }));
      try {
        const res = await teamFilesApiService.getProjectFiles({
          page,
          size: pageSize,
          search: searchValue || undefined,
          project_id: filters.projectId,
          file_type: filters.fileType,
          uploaded_by: filters.uploadedBy,
        });
        if (res.done) {
          setProjectFilesState({
            data: res.body.data || [],
            total: res.body.total || 0,
            page,
            pageSize,
            loading: false,
          });
        } else {
          setProjectFilesState(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        logger.error('Error fetching team project files', error);
        setProjectFilesState(prev => ({ ...prev, loading: false }));
      }
    },
    [searchValue, filters]
  );

  const fetchTaskAttachments = React.useCallback(
    async (page: number, pageSize: number) => {
      setTaskAttachmentsState(prev => ({ ...prev, loading: true }));
      try {
        const res = await teamFilesApiService.getTaskAttachments({
          page,
          size: pageSize,
          search: searchValue || undefined,
          project_id: filters.projectId,
          file_type: filters.fileType,
          uploaded_by: filters.uploadedBy,
        });
        if (res.done) {
          setTaskAttachmentsState({
            data: res.body.data || [],
            total: res.body.total || 0,
            page,
            pageSize,
            loading: false,
          });
        } else {
          setTaskAttachmentsState(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        logger.error('Error fetching team task attachments', error);
        setTaskAttachmentsState(prev => ({ ...prev, loading: false }));
      }
    },
    [searchValue, filters]
  );

  const fetchLinks = React.useCallback(
    async (page: number, pageSize: number) => {
      setLinksState(prev => ({ ...prev, loading: true }));
      try {
        const res = await teamFilesApiService.getLinks({
          page,
          size: pageSize,
          search: searchValue || undefined,
          project_id: filters.projectId,
          uploaded_by: filters.uploadedBy,
        });
        if (res.done) {
          setLinksState({ data: res.body.data || [], total: res.body.total || 0, page, pageSize, loading: false });
        } else {
          setLinksState(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        logger.error('Error fetching team links', error);
        setLinksState(prev => ({ ...prev, loading: false }));
      }
    },
    [searchValue, filters]
  );

  React.useEffect(() => {
    if (activeTab === 'project') void fetchProjectFiles(1, projectFilesState.pageSize);
    else if (activeTab === 'task') void fetchTaskAttachments(1, taskAttachmentsState.pageSize);
    else void fetchLinks(1, linksState.pageSize);
  }, [activeTab, fetchProjectFiles, fetchTaskAttachments, fetchLinks]);

  const handlePageChange = (page: number, pageSize: number) => {
    if (activeTab === 'project') void fetchProjectFiles(page, pageSize);
    else if (activeTab === 'task') void fetchTaskAttachments(page, pageSize);
    else void fetchLinks(page, pageSize);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewUrl(null);
    setPreviewName(null);
    setPreviewDownloadFn(null);
  };

  const downloadProjectFile = async (row: ITeamProjectFileRow) => {
    try {
      setDownloadingId(row.id);
      const res = await projectFilesApiService.download(row.project_id, row.id, row.name);
      if (res.done && res.body?.url) {
        const link = document.createElement('a');
        link.href = res.body.url;
        link.download = row.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      logger.error('Error downloading team file', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
    } finally {
      setDownloadingId(null);
    }
  };

  const previewProjectFile = async (row: ITeamProjectFileRow) => {
    setPreviewName(row.name);
    setPreviewUrl(null);
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const res = await projectFilesApiService.download(row.project_id, row.id, row.name);
      if (res.done && res.body?.url) {
        setPreviewUrl(res.body.url);
        setPreviewDownloadFn(() => () => void downloadProjectFile(row));
      }
    } catch (error) {
      logger.error('Error previewing team file', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const deleteProjectFile = async (row: ITeamProjectFileRow) => {
    try {
      setDeletingId(row.id);
      const res = await projectFilesApiService.delete(row.project_id, row.id);
      if (res.done) {
        message.success(t('deleteSuccess', { defaultValue: 'File deleted successfully.' }));
        void fetchProjectFiles(1, projectFilesState.pageSize);
      }
    } catch (error) {
      logger.error('Error deleting team file', error);
      message.error(t('deleteFailed', { defaultValue: 'Unable to delete file.' }));
    } finally {
      setDeletingId(null);
    }
  };

  const downloadTaskAttachment = async (row: ITeamTaskAttachmentRow) => {
    try {
      setDownloadingId(row.id);
      const res = await taskAttachmentsApiService.downloadTaskAttachment(row.id, row.name);
      if (res.done && res.body?.url) {
        const link = document.createElement('a');
        link.href = res.body.url;
        link.download = row.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      logger.error('Error downloading team task attachment', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
    } finally {
      setDownloadingId(null);
    }
  };

  const previewTaskAttachment = async (row: ITeamTaskAttachmentRow) => {
    setPreviewName(row.name);
    setPreviewUrl(null);
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const res = await taskAttachmentsApiService.downloadTaskAttachment(row.id, row.name);
      if (res.done && res.body?.url) {
        setPreviewUrl(res.body.url);
        setPreviewDownloadFn(() => () => void downloadTaskAttachment(row));
      }
    } catch (error) {
      logger.error('Error previewing team task attachment', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const deleteTaskAttachment = async (row: ITeamTaskAttachmentRow) => {
    try {
      setDeletingId(row.id);
      const res = await taskAttachmentsApiService.deleteTaskAttachment(row.id);
      if (res.done) {
        message.success(t('deleteSuccess', { defaultValue: 'File deleted successfully.' }));
        void fetchTaskAttachments(1, taskAttachmentsState.pageSize);
      }
    } catch (error) {
      logger.error('Error deleting team task attachment', error);
      message.error(t('deleteFailed', { defaultValue: 'Unable to delete file.' }));
    } finally {
      setDeletingId(null);
    }
  };

  const openLink = (row: ITeamProjectLinkRow) => {
    if (row.source_type === 'manual') {
      window.open(row.url, '_blank', 'noopener,noreferrer');
    } else if (row.source_task_id) {
      dispatch(setSelectedTaskId(row.source_task_id));
      dispatch(setShowTaskDrawer(true));
    }
  };

  const deleteLink = async (row: ITeamProjectLinkRow) => {
    try {
      setDeletingId(row.id);
      const res = await projectLinksApiService.delete(row.project_id, row.id);
      if (res.done) {
        message.success(t('deleteLinkSuccess', { defaultValue: 'Link deleted successfully.' }));
        void fetchLinks(1, linksState.pageSize);
      }
    } catch (error) {
      logger.error('Error deleting team link', error);
      message.error(t('deleteLinkFailed', { defaultValue: 'Unable to delete link.' }));
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddLink = async (projectId: string, body: ICreateLinkBody) => {
    setLinkModalLoading(true);
    try {
      const res = await projectLinksApiService.create(projectId, body);
      if (res.done) {
        message.success(t('addLinkSuccess', { defaultValue: 'Link added successfully.' }));
        setLinkModalOpen(false);
        void fetchLinks(1, linksState.pageSize);
      }
    } catch (error) {
      logger.error('Error adding team link', error);
      message.error(t('addLinkFailed', { defaultValue: 'Unable to add link.' }));
    } finally {
      setLinkModalLoading(false);
    }
  };

  const handleEditLink = async (projectId: string, linkId: string, body: IUpdateLinkBody) => {
    setLinkModalLoading(true);
    try {
      const res = await projectLinksApiService.update(projectId, linkId, body);
      if (res.done) {
        message.success(t('editLinkSuccess', { defaultValue: 'Link updated successfully.' }));
        setLinkModalOpen(false);
        setEditingLink(null);
        void fetchLinks(linksState.page, linksState.pageSize);
      }
    } catch (error) {
      logger.error('Error updating team link', error);
      message.error(t('editLinkFailed', { defaultValue: 'Unable to update link.' }));
    } finally {
      setLinkModalLoading(false);
    }
  };

  const handleSearch = (value: string) => setSearchValue(value.trim());

  const activeState =
    activeTab === 'project' ? projectFilesState : activeTab === 'task' ? taskAttachmentsState : linksState;

  return (
    <div>
      <Flex vertical style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('pageTitle', { defaultValue: 'Files' })}
        </Title>
        <Typography.Text type="secondary">
          {t('pageSubtitle', { defaultValue: 'Centralised file storage across all projects' })}
        </Typography.Text>
      </Flex>

      <Flex style={{ marginBottom: 12 }}>
        <PillToggle<FilesTableMode>
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'project', label: t('projectFilesTab', { defaultValue: 'Project Files' }) },
            { value: 'task', label: t('taskAttachmentsTab', { defaultValue: 'Task Attachments' }) },
            { value: 'links', label: t('linksTab', { defaultValue: 'Links' }) },
          ]}
        />
      </Flex>

      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <FilesFilters value={filters} onChange={setFilters} showFileType={activeTab !== 'links'} />

        <Space size={8} wrap style={{ justifyContent: 'flex-end' }}>
          <Input
            allowClear
            placeholder={t('searchPlaceholder', { defaultValue: 'Search files...' })}
            style={{ width: 220, maxWidth: '100%', height: 30, fontSize: 12 }}
            onChange={e => handleSearch(e.target.value)}
            suffix={<SearchOutlined style={{ color: 'rgba(0,0,0,.45)' }} />}
            onPressEnter={e => handleSearch((e.target as HTMLInputElement).value)}
          />
          {activeTab !== 'links' ? (
            <Button
              type="primary"
              icon={<ImportOutlined />}
              style={{ height: 30, fontSize: 12 }}
              onClick={() => setUploadModalOpen(true)}
            >
              {t('uploadButton', { defaultValue: 'Upload File' })}
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ height: 30, fontSize: 12 }}
              onClick={() => {
                setEditingLink(null);
                setLinkModalOpen(true);
              }}
            >
              {t('addLink', { defaultValue: 'Add Link' })}
            </Button>
          )}
        </Space>
      </Flex>

      <FilesTable
        mode={activeTab}
        projectFiles={projectFilesState.data}
        taskAttachments={taskAttachmentsState.data}
        links={linksState.data}
        loading={activeState.loading}
        total={activeState.total}
        page={activeState.page}
        pageSize={activeState.pageSize}
        onPageChange={handlePageChange}
        onPreviewFile={previewProjectFile}
        onPreviewAttachment={previewTaskAttachment}
        onDownloadFile={downloadProjectFile}
        onDeleteFile={deleteProjectFile}
        onDownloadAttachment={downloadTaskAttachment}
        onDeleteAttachment={deleteTaskAttachment}
        onOpenLink={openLink}
        onEditLink={row => {
          setEditingLink(row);
          setLinkModalOpen(true);
        }}
        onDeleteLink={deleteLink}
        downloadingId={downloadingId}
        deletingId={deletingId}
      />

      <FilePreviewModal
        open={previewOpen}
        name={previewName || undefined}
        url={previewUrl || undefined}
        isLoading={previewLoading}
        onClose={closePreview}
        onDownload={previewDownloadFn || undefined}
      />

      <UploadFilesModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploaded={() => void fetchProjectFiles(1, projectFilesState.pageSize)}
      />

      <AddTeamLinkModal
        open={linkModalOpen}
        loading={linkModalLoading}
        editingLink={editingLink}
        onSubmitAdd={handleAddLink}
        onSubmitEdit={handleEditLink}
        onCancel={() => {
          setLinkModalOpen(false);
          setEditingLink(null);
        }}
      />

      {createPortal(<TaskDrawer />, document.body, 'team-files-task-drawer')}
    </div>
  );
};

export default FilesPage;
