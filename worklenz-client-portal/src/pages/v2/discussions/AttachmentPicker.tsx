import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CloseOutlined,
  ExclamationCircleOutlined,
  Flex,
  LoadingOutlined,
  PaperClipOutlined,
  Tooltip,
  theme,
} from '@/shared/antd-imports';
import type { MessageAttachmentsController } from './useMessageAttachments';
import { formatFileSize } from './discussionUtils';

interface AttachButtonProps {
  controller: MessageAttachmentsController;
  disabled?: boolean;
  /** Why the button is off, shown on hover (a role or project setting that does not allow files). */
  disabledReason?: string;
}

/** The paperclip next to Send. Opens the file picker; several files can be chosen at once. */
export const AttachButton = ({ controller, disabled = false, disabledReason }: AttachButtonProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const label = t('discussions.attach', { defaultValue: 'Attach files' });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        aria-label={label}
        data-testid="attachment-input"
        onChange={event => {
          controller.add(Array.from(event.target.files ?? []));
          // The same file can be chosen again after it was removed.
          event.target.value = '';
        }}
      />
      <Tooltip title={disabled && disabledReason ? disabledReason : label}>
        {/* The span keeps the tooltip working on a disabled button. */}
        <span>
          <Button
            icon={<PaperClipOutlined />}
            aria-label={label}
            disabled={disabled || controller.isFull}
            onClick={() => inputRef.current?.click()}
          />
        </span>
      </Tooltip>
    </>
  );
};

/** The files chosen for the message being written, each with its state and a remove button. */
export const AttachmentChips = ({ controller }: { controller: MessageAttachmentsController }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  if (controller.items.length === 0) return null;

  return (
    <Flex gap={6} wrap="wrap" role="list" aria-label={t('discussions.attachments', { defaultValue: 'Attachments' })} style={{ marginTop: 6 }}>
      {controller.items.map(item => (
        <Flex
          key={item.key}
          role="listitem"
          align="center"
          gap={6}
          style={{
            maxWidth: 260,
            padding: '2px 4px 2px 8px',
            borderRadius: token.borderRadius,
            fontSize: 12,
            border: `1px solid ${item.status === 'failed' ? token.colorError : token.colorBorder}`,
            background: token.colorFillQuaternary,
          }}
        >
          {item.status === 'uploading' ? (
            <LoadingOutlined aria-hidden />
          ) : item.status === 'failed' ? (
            <ExclamationCircleOutlined aria-hidden style={{ color: token.colorError }} />
          ) : (
            <PaperClipOutlined aria-hidden style={{ color: token.colorTextSecondary }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
            {item.name}
          </span>
          <span style={{ color: item.status === 'failed' ? token.colorError : token.colorTextTertiary, flexShrink: 0 }} title={item.error}>
            {item.status === 'uploading'
              ? t('discussions.attachUploading', { defaultValue: 'Uploading…' })
              : item.status === 'failed'
                ? t('discussions.attachFailedShort', { defaultValue: 'Failed' })
                : formatFileSize(item.size)}
          </span>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            aria-label={t('discussions.removeAttachment', { name: item.name, defaultValue: 'Remove {{name}}' })}
            onClick={() => controller.remove(item.key)}
          />
        </Flex>
      ))}
      {controller.items.map(item =>
        item.status === 'failed' && item.error ? (
          <div key={`${item.key}-error`} role="alert" style={{ width: '100%', fontSize: 12, color: token.colorError }}>
            {item.error}
          </div>
        ) : null
      )}
    </Flex>
  );
};
