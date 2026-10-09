import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { message } from '@/shared/antd-imports';
import type { TFunction } from 'i18next';

vi.mock('@/shared/antd-imports', () => ({
  message: { error: vi.fn() },
}));

vi.mock('./attachments-preview', () => ({
  default: () => <div data-testid="attachments-preview" />,
}));

vi.mock('./attachments-upload', () => ({
  default: () => <div data-testid="attachments-upload" />,
}));

vi.mock('./upload-progress', () => ({
  TaskAttachmentUploadProgress: () => <div data-testid="upload-progress" />,
}));

import AttachmentsGrid from './attachments-grid';

const t = ((key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key) as TFunction;

const createFile = (name: string, size = 16, type = 'text/plain') =>
  new File([new Uint8Array(size)], name, { type });

/** Builds a paste event whose clipboardData matches what the grid reads. */
const createPasteEvent = (files: File[], text = '') => {
  const clipboardData = {
    items: files.map(file => ({ kind: 'file', getAsFile: () => file })),
    files,
    types: files.length > 0 ? ['Files'] : ['text/plain'],
    getData: () => text,
  };
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  return event;
};

const renderGrid = (props: Record<string, unknown> = {}) => {
  const handleFilesSelected = vi.fn();
  const utils = render(
    <AttachmentsGrid
      attachments={[]}
      t={t}
      loadingTask={false}
      uploading={false}
      handleFilesSelected={handleFilesSelected}
      {...props}
    />
  );
  const pasteTarget = utils.container.querySelector('.attachments-container') as HTMLElement;
  return { ...utils, handleFilesSelected, pasteTarget };
};

describe('AttachmentsGrid paste-to-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends pasted files to the existing upload handler', () => {
    const { handleFilesSelected, pasteTarget } = renderGrid();
    const file = createFile('report.pdf', 128, 'application/pdf');
    const event = createPasteEvent([file]);

    fireEvent(pasteTarget, event);

    expect(event.defaultPrevented).toBe(true);
    expect(handleFilesSelected).toHaveBeenCalledTimes(1);
    expect(handleFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('ignores text-only pastes and leaves the default action alone', () => {
    const { handleFilesSelected, pasteTarget } = renderGrid();
    const event = createPasteEvent([], 'just some text');

    fireEvent(pasteTarget, event);

    expect(handleFilesSelected).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not intercept pastes inside inputs or rich-text editors', () => {
    const { container, handleFilesSelected } = renderGrid();
    const input = document.createElement('input');
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    container.append(input, editor);

    const inputEvent = createPasteEvent([createFile('a.png', 16, 'image/png')]);
    fireEvent(input, inputEvent);
    const editorEvent = createPasteEvent([createFile('b.png', 16, 'image/png')]);
    fireEvent(editor, editorEvent);

    expect(handleFilesSelected).not.toHaveBeenCalled();
    expect(inputEvent.defaultPrevented).toBe(false);
    expect(editorEvent.defaultPrevented).toBe(false);
  });

  it('reports oversized files and uploads nothing', () => {
    const { handleFilesSelected, pasteTarget } = renderGrid({ maxFileSizeMb: 1 });
    const event = createPasteEvent([createFile('huge.bin', 2 * 1024 * 1024)]);

    fireEvent(pasteTarget, event);

    expect(message.error).toHaveBeenCalledTimes(1);
    expect(handleFilesSelected).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('uploads valid files and reports oversized ones in a mixed paste', () => {
    const { handleFilesSelected, pasteTarget } = renderGrid({ maxFileSizeMb: 1 });
    const valid = createFile('notes.txt', 512);
    const oversized = createFile('huge.bin', 2 * 1024 * 1024);

    fireEvent(pasteTarget, createPasteEvent([valid, oversized]));

    expect(message.error).toHaveBeenCalledTimes(1);
    expect(handleFilesSelected).toHaveBeenCalledTimes(1);
    expect(handleFilesSelected).toHaveBeenCalledWith([valid]);
  });

  it('does not attach a paste handler for guest grids', () => {
    const { handleFilesSelected, pasteTarget } = renderGrid({ isGuest: true });

    fireEvent(pasteTarget, createPasteEvent([createFile('guest.txt')]));

    expect(handleFilesSelected).not.toHaveBeenCalled();
  });

  it('does not attach a paste handler for comment attachment grids', () => {
    const { handleFilesSelected, pasteTarget } = renderGrid({ isCommentAttachment: true });

    fireEvent(pasteTarget, createPasteEvent([createFile('comment.png', 16, 'image/png')]));

    expect(handleFilesSelected).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const { handleFilesSelected, unmount } = renderGrid();
    unmount();

    fireEvent(document.body, createPasteEvent([createFile('late.txt')]));

    expect(handleFilesSelected).not.toHaveBeenCalled();
  });
});
