import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseOutlined, ExclamationCircleOutlined, LoadingOutlined, PaperClipOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip, theme } from '@/shared/antd-imports';
import { formatFileSize } from '@/components/client-portal/v2/file-rules';
import type { MessageAttachmentsController } from './useMessageAttachments';

interface AttachButtonProps {
  controller: MessageAttachmentsController;
  disabled?: boolean;
}

/** The paperclip next to Send. Opens the file picker; several files can be chosen at once. */
export const AttachButton = ({ controller, disabled = false }: AttachButtonProps) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const inputRef = useRef<HTMLInputElement>(null);
  const label = t('composer.attach', { defaultValue: 'Attach files' });

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
      <Tooltip title={label}>
        <Button
          icon={<PaperClipOutlined />}
          aria-label={label}
          disabled={disabled || controller.isFull}
          onClick={() => inputRef.current?.click()}
        />
      </Tooltip>
    </>
  );
};

/** The files chosen for the message being written, each with its progress and a remove button. */
export const AttachmentChips = ({ controller }: { controller: MessageAttachmentsController }) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const { token } = theme.useToken();
  if (controller.items.length === 0) return null;

  return (
    <Flex
      gap={6}
      wrap="wrap"
      role="list"
      aria-label={t('composer.attachments', { defaultValue: 'Attachments' })}
      style={{ marginTop: 6 }}
    >
      {controller.items.map(item => (
        <Flex
          key={item.key}
          role="listitem"
          align="center"
          gap={6}
          style={{
            maxWidth: 260,
            padding: '2px 4px 2px 8px',
            borderRadius: 6,
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
          <span style={{ color: token.colorTextTertiary, flexShrink: 0 }}>
            {item.status === 'uploading'
              ? `${item.progress}%`
              : item.status === 'failed'
                ? t('composer.attachFailedShort', { defaultValue: 'Failed' })
                : formatFileSize(item.size)}
          </span>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            aria-label={t('composer.removeAttachment', { name: item.name, defaultValue: 'Remove {{name}}' })}
            onClick={() => controller.remove(item.key)}
          />
        </Flex>
      ))}
    </Flex>
  );
};
