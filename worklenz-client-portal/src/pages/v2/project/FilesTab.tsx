import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Flex,
  Modal,
  Select,
  Table,
  Tag,
  Typography,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  UploadOutlined,
} from '@/shared/antd-imports';
import type { TableColumnsType } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useGetFilesQuery } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import { FILE_CATEGORIES, useFileAccess, useUploadFile } from '@/hooks/useFileActions';
import { EmptyState, FieldsButton, KeyValueList, LockedNote, QueryState, UnavailableBanner, errorMessage, useColumnVisibility } from '@/components/v2';
import type { ColumnField } from '@/components/v2';
import type { ClientFileV2, ClientProjectV2 } from '@/types/v2';

const HIGHLIGHT_MS = 3500;

/** Files the team shared, plus the ones this client uploaded. Download and preview re-check access each time. */
export const FilesTab: React.FC<{ project: ClientProjectV2; autoOpenUpload?: boolean }> = ({ project, autoOpenUpload = false }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const wanted = searchParams.get('file');
  const query = useGetFilesQuery(project.id);
  const { can, me } = useClientAccess();
  const { date } = useFormatters();
  const { openFile } = useFileAccess();
  const [category, setCategory] = useState<string>('all');
  const [preview, setPreview] = useState<ClientFileV2 | null>(null);
  const columnVisibility = useColumnVisibility('worklenz.clientportal.files.hiddenColumns');
  const [uploadOpen, setUploadOpen] = useState(autoOpenUpload && can.upload && project.allow_uploads);
  const [highlight, setHighlight] = useState<string | null>(wanted);

  useEffect(() => {
    if (!wanted) return undefined;
    setHighlight(wanted);
    const timer = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [wanted]);

  const files = query.data ?? [];
  const missing = Boolean(wanted) && query.isSuccess && !files.some(file => file.id === wanted);
  const categories = Array.from(new Set(files.map(file => file.category)));
  const shown = files.filter(file => category === 'all' || file.category === category);
  const canUpload = can.upload && project.allow_uploads;

  const columns: TableColumnsType<ClientFileV2> = [
    {
      title: t('files.file', { defaultValue: 'File' }),
      key: 'name',
      dataIndex: 'name',
      render: (name: string) => (
        <Flex gap={8} align="center">
          <FileTextOutlined aria-hidden />
          <Typography.Text strong>{name}</Typography.Text>
        </Flex>
      ),
    },
    { title: t('files.size', { defaultValue: 'Size' }), key: 'size', dataIndex: 'size_label', responsive: ['sm'] },
    { title: t('files.category', { defaultValue: 'Category' }), key: 'category', dataIndex: 'category', responsive: ['md'] },
    {
      title: t('files.version', { defaultValue: 'Version' }),
      key: 'version',
      responsive: ['sm'],
      render: (_: unknown, file) => `v${file.version}`,
    },
    {
      title: t('files.versionsColumn', { defaultValue: 'Versions' }),
      key: 'versions',
      responsive: ['lg'],
      render: (_: unknown, file) => file.version_count ?? 1,
    },
    {
      title: t('files.uploadedBy', { defaultValue: 'Uploaded by' }),
      key: 'uploaded_by',
      dataIndex: 'uploaded_by',
      responsive: ['lg'],
    },
    {
      title: t('files.source', { defaultValue: 'Source' }),
      key: 'source',
      responsive: ['lg'],
      render: (_: unknown, file) =>
        file.source === 'client' ? (
          <Tag color="purple" style={{ marginInlineEnd: 0 }}>
            {file.uploaded_by === me?.name ? t('files.you', { defaultValue: 'You' }) : t('files.client', { defaultValue: 'Client' })}
          </Tag>
        ) : (
          t('files.team', { defaultValue: 'Team' })
        ),
    },
    { title: t('files.date', { defaultValue: 'Date' }), key: 'date', dataIndex: 'uploaded_at', responsive: ['md'], render: (value: string) => date(value) },
    {
      title: '',
      key: 'actions',
      width: 150,
      render: (_: unknown, file) => (
        <Flex gap={6}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setPreview(file)}>
            {t('files.preview', { defaultValue: 'Preview' })}
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            aria-label={`${t('files.download', { defaultValue: 'Download' })} ${file.name}`}
            onClick={() => void openFile(file, 'download', file.version)}
          />
        </Flex>
      ),
    },
  ];

  const fields: ColumnField[] = [
    { key: 'size', label: t('files.size', { defaultValue: 'Size' }) },
    { key: 'category', label: t('files.category', { defaultValue: 'Category' }) },
    { key: 'version', label: t('files.version', { defaultValue: 'Version' }) },
    { key: 'versions', label: t('files.versionsColumn', { defaultValue: 'Versions' }) },
    { key: 'uploaded_by', label: t('files.uploadedBy', { defaultValue: 'Uploaded by' }) },
    { key: 'source', label: t('files.source', { defaultValue: 'Source' }) },
    { key: 'date', label: t('files.date', { defaultValue: 'Date' }) },
  ];

  return (
    <QueryState {...query} refetch={query.refetch}>
      {missing && <UnavailableBanner what="file" />}
      <Flex justify="space-between" align="center" wrap="wrap" gap={10} style={{ marginBottom: 12 }}>
        <Flex gap={6} wrap="wrap">
          {['all', ...categories].map(item => (
            <Tag.CheckableTag key={item} checked={category === item} onChange={() => setCategory(item)}>
              {item === 'all' ? t('files.all', { count: files.length, defaultValue: 'All ({{count}})' }) : item}
            </Tag.CheckableTag>
          ))}
        </Flex>
        <Flex gap={8} align="center">
        <FieldsButton fields={fields} hidden={columnVisibility.hidden} onToggle={columnVisibility.toggle} />
        {canUpload ? (
          <Button type="primary" size="small" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            {t('files.upload', { defaultValue: 'Upload file' })}
          </Button>
        ) : (
          <LockedNote>
            {!can.upload
              ? t('locked.upload', { defaultValue: "Client Viewers can't upload files." })
              : t('locked.uploadsOff', { defaultValue: 'Uploads are turned off for this project.' })}
          </LockedNote>
        )}
        </Flex>
      </Flex>

      {files.length === 0 ? (
        <EmptyState title={t('files.none', { defaultValue: 'No files are shared with you yet.' })} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<ClientFileV2>
            rowKey="id"
            tableLayout="auto"
            columns={columnVisibility.visibleColumns(columns)}
            dataSource={shown}
            pagination={false}
            scroll={{ x: 'max-content' }}
            onRow={file => ({ style: highlight === file.id ? { background: 'var(--portal-brand-tint)' } : undefined })}
          />
        </Card>
      )}

      <Modal
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        title={preview?.name}
        width={560}
        footer={[
          <Button key="close" onClick={() => setPreview(null)}>
            {t('common.close', { defaultValue: 'Close' })}
          </Button>,
          <Button
            key="open"
            icon={<EyeOutlined />}
            onClick={() => preview && void openFile(preview, 'preview', preview.version)}
          >
            {t('files.openPreview', { defaultValue: 'Open preview' })}
          </Button>,
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => preview && void openFile(preview, 'download', preview.version)}>
            {t('files.download', { defaultValue: 'Download' })}
          </Button>,
        ]}
      >
        {preview && (
          <KeyValueList
            rows={[
              [t('files.category', { defaultValue: 'Category' }), preview.category],
              [t('files.version', { defaultValue: 'Version' }), `v${preview.version}`],
              [t('files.uploadedBy', { defaultValue: 'Uploaded by' }), preview.uploaded_by ?? '—'],
              [t('files.date', { defaultValue: 'Date' }), date(preview.uploaded_at)],
              [t('files.size', { defaultValue: 'Size' }), preview.size_label],
            ]}
          />
        )}
      </Modal>

      <UploadModal open={uploadOpen} projectId={project.id} onClose={() => setUploadOpen(false)} />
    </QueryState>
  );
};

const UploadModal = ({ open, projectId, onClose }: { open: boolean; projectId: string; onClose: () => void }) => {
  const { t } = useTranslation();
  const message = useMessage();
  const upload = useUploadFile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('Supporting Document');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setCategory('Supporting Document');
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      await upload(projectId, file, category);
      void message.success(t('files.uploaded', { name: file.name, defaultValue: '{{name}} uploaded. Your team can see it and is notified.' }));
      onClose();
    } catch (error) {
      void message.error(errorMessage(error) ?? t('files.uploadFailed', { defaultValue: 'The upload failed. Please try again.' }));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('files.uploadTitle', { defaultValue: 'Upload a file' })}
      width={460}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>,
        <Button key="upload" type="primary" loading={busy} disabled={!file} onClick={() => void submit()}>
          {t('files.uploadAction', { defaultValue: 'Upload' })}
        </Button>,
      ]}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        data-testid="upload-input"
        onChange={event => setFile(event.target.files?.[0] ?? null)}
      />
      <Flex vertical align="center" gap={8} style={{ border: '1px dashed currentColor', borderRadius: 8, padding: '18px 10px', marginBottom: 14, opacity: 0.9 }}>
        <Button onClick={() => inputRef.current?.click()}>{t('files.choose', { defaultValue: 'Choose file' })}</Button>
        <Typography.Text strong>{file?.name ?? t('files.noneChosen', { defaultValue: 'No file chosen' })}</Typography.Text>
      </Flex>
      <Typography.Text type="secondary">{t('files.category', { defaultValue: 'Category' })}</Typography.Text>
      <Select
        style={{ width: '100%', margin: '4px 0 10px' }}
        value={category}
        onChange={setCategory}
        options={FILE_CATEGORIES.map(value => ({ value, label: value }))}
        aria-label={t('files.category', { defaultValue: 'Category' })}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('files.uploadHint', { defaultValue: 'Files you upload are visible to your project team and recorded as client activity.' })}
      </Typography.Text>
    </Modal>
  );
};
