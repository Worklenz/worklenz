import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [speed, setSpeed] = useState<number | undefined>(undefined);
  // Upload start time lives in a ref: storing it in state made the effect
  // below depend on a value it also sets, which re-ran it forever while the
  // file was uploading ("Maximum update depth exceeded").
  const startedAtRef = useRef<number | null>(null);
  // Latest progress values, read by the interval without restarting it.
  const percentRef = useRef(0);
  const fileSizeRef = useRef(file.size);

  const percent = useMemo(() => Math.max(0, Math.min(100, file.percent ?? 0)), [file.percent]);

  useEffect(() => {
    percentRef.current = percent;
    fileSizeRef.current = file.size;
  }, [percent, file.size]);

  useEffect(() => {
    if (file.status !== 'uploading') {
      startedAtRef.current = null;
      setSpeed(undefined);
      return;
    }

    startedAtRef.current = Date.now();
    setSpeed(undefined);

    const interval = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt === null) return;
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs <= 0) return;
      const uploadedBytes = (fileSizeRef.current * percentRef.current) / 100;
      setSpeed((uploadedBytes / elapsedMs) * 1000);
    }, 500);

    return () => window.clearInterval(interval);
  }, [file.status, file.uid]);

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
