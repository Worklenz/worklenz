import React, { useEffect, useMemo, useState } from 'react';
import { Flex, Progress, Typography } from '@/shared/antd-imports';
import { formatFileSize } from '@/pages/projects/projectView/files/utils';

export interface TaskAttachmentUploadItem {
  uid: string;
  name: string;
  size: number;
  percent?: number;
  status: 'ready' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

export const formatUploadSpeed = (bytesPerSecond?: number): string | undefined => {
  if (bytesPerSecond === undefined || bytesPerSecond === null) return undefined;
  if (bytesPerSecond <= 0) return '0 B/s';

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let value = bytesPerSecond;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

interface TaskAttachmentUploadProgressProps {
  file: TaskAttachmentUploadItem;
}

export const TaskAttachmentUploadProgress: React.FC<TaskAttachmentUploadProgressProps> = ({ file }) => {
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (file.status !== 'uploading') {
      return;
    }

    setUploadedBytes(0);
    setStartedAt(Date.now());
    setSpeed(undefined);

    const interval = window.setInterval(() => {
      if (startedAt === null) return;
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs <= 0) return;
      const bytesPerSecond = (uploadedBytes / elapsedMs) * 1000;
      setSpeed(bytesPerSecond);
    }, 500);

    return () => window.clearInterval(interval);
  }, [file.status, file.uid, startedAt, uploadedBytes]);

  const percent = useMemo(() => Math.max(0, Math.min(100, file.percent ?? 0)), [file.percent]);

  if (file.status === 'done') {
    return (
      <Flex vertical gap={4} style={{ width: '100%' }}>
        <Typography.Text type="secondary">{file.name}</Typography.Text>
        <Typography.Text type="success">Uploaded</Typography.Text>
      </Flex>
    );
  }

  if (file.status === 'error') {
    return (
      <Flex vertical gap={4} style={{ width: '100%' }}>
        <Typography.Text type="secondary">{file.name}</Typography.Text>
        <Typography.Text type="danger">{file.errorMessage || 'Upload failed'}</Typography.Text>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={6} style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <Typography.Text>{file.name}</Typography.Text>
        <Typography.Text type="secondary">{formatFileSize(file.size)}</Typography.Text>
      </Flex>
      <Flex justify="space-between" align="center">
        <Typography.Text type="secondary">{percent}%</Typography.Text>
        {speed !== undefined && (
          <Typography.Text type="secondary">{formatUploadSpeed(speed)}</Typography.Text>
        )}
      </Flex>
      <Progress percent={percent} size="small" showInfo={false} />
    </Flex>
  );
};

export default TaskAttachmentUploadProgress;
