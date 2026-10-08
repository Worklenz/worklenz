import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@/types/task-management.types';

const { confirmTaskAttachment, presignTaskAttachment, uploadDirect } = vi.hoisted(() => ({
  confirmTaskAttachment: vi.fn(),
  presignTaskAttachment: vi.fn(),
  uploadDirect: vi.fn(),
}));

vi.mock('@/api/tasks/task-attachments.api.service', () => ({
  default: {
    confirmTaskAttachment,
    presignTaskAttachment,
    uploadDirect,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => options?.defaultValue || key,
  }),
}));

vi.mock('@/components/common/FilePreviewModal', () => ({
  FilePreviewModal: () => null,
}));

import { AttachmentsColumn } from './AttachmentsColumn';

const TASK_WITH_ATTACHMENT: Task = {
  id: 'task-1',
  status: 'todo',
  priority: 'medium',
  created_at: '2026-09-29T00:00:00.000Z',
  updated_at: '2026-09-29T00:00:00.000Z',
  attachments: [
    {
      id: 'attachment-1',
      name: 'existing.pdf',
      type: 'application/pdf',
    },
  ],
};

describe('AttachmentsColumn', () => {
  beforeEach(() => {
    presignTaskAttachment.mockReset();
    uploadDirect.mockReset();
    confirmTaskAttachment.mockReset();

    presignTaskAttachment.mockResolvedValue({
      done: true,
      body: { file_id: 'file-2', upload_url: 'https://storage.example/upload' },
    });
    uploadDirect.mockResolvedValue(undefined);
    confirmTaskAttachment.mockResolvedValue({
      done: true,
      body: { id: 'attachment-2', name: 'new.txt', type: 'text/plain' },
    });
  });

  it('uploads a selected file from the populated-state add attachment control', async () => {
    const { container } = render(
      <AttachmentsColumn width="160px" task={TASK_WITH_ATTACHMENT} projectId="project-1" />
    );
    const fileInput = container.querySelector('input[type="file"]');

    expect(fileInput).not.toBeNull();
    const clickSpy = vi.spyOn(fileInput as HTMLInputElement, 'click');

    fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
    expect(clickSpy).toHaveBeenCalledOnce();

    const file = new File(['attachment content'], 'new.txt', { type: 'text/plain' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() =>
      expect(presignTaskAttachment).toHaveBeenCalledWith(
        'task-1',
        'project-1',
        'new.txt',
        file.size,
        'text/plain'
      )
    );
    expect(uploadDirect).toHaveBeenCalledWith('https://storage.example/upload', file);
    expect(confirmTaskAttachment).toHaveBeenCalledWith('file-2', 'task-1');
  });
});
