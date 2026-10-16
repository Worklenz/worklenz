import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, PaperClipOutlined, Tooltip, theme } from '@/shared/antd-imports';
import { useFileAccess } from '@/hooks/useFileActions';
import { useGetFileAccessMutation } from '@/store/api-v2';
import type { ClientThreadAttachmentV2 } from '@/types/v2';
import { formatFileSize } from './discussionUtils';

const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);

/** SVG is left out on purpose: it can carry script, so it is offered as a download like any other file. */
const isImageAttachment = (attachment: ClientThreadAttachmentV2): boolean => {
  const extension = attachment.type || (attachment.name.includes('.') ? (attachment.name.split('.').pop() ?? '') : '');
  return IMAGE_TYPES.has(extension.toLowerCase());
};

/** An image shown in the message. Click it to download the original. */
const AttachmentImage = ({ attachment, onDownload }: { attachment: ClientThreadAttachmentV2; onDownload: () => void }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [requestAccess] = useGetFileAccessMutation();
  const [src, setSrc] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    if (!attachment.file_id) return undefined;
    requestAccess({ fileId: attachment.file_id, action: 'preview' })
      .unwrap()
      .then(result => {
        if (isCurrent) setSrc(result.url);
      })
      .catch(() => {
        if (isCurrent) setHasFailed(true);
      });
    return () => {
      isCurrent = false;
    };
  }, [attachment.file_id, requestAccess]);

  // While the link loads, or if it cannot be made, the file is still reachable as a named button.
  if (!src || hasFailed) return <FileChip attachment={attachment} onDownload={onDownload} />;

  const label = t('discussions.downloadAttachment', { name: attachment.name, defaultValue: 'Download {{name}}' });
  return (
    <Tooltip title={label}>
      <button
        type="button"
        onClick={onDownload}
        aria-label={label}
        style={{
          padding: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          background: 'transparent',
          cursor: 'pointer',
          lineHeight: 0,
          overflow: 'hidden',
        }}
      >
        <img
          src={src}
          alt={attachment.name}
          loading="lazy"
          onError={() => setHasFailed(true)}
          style={{ display: 'block', maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }}
        />
      </button>
    </Tooltip>
  );
};

/** Any other file: a chip with its name and size. */
const FileChip = ({ attachment, onDownload }: { attachment: ClientThreadAttachmentV2; onDownload: () => void }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isAvailable = attachment.file_id !== null;
  const label = t('discussions.downloadAttachment', { name: attachment.name, defaultValue: 'Download {{name}}' });

  return (
    <Tooltip title={isAvailable ? label : t('discussions.attachmentRemoved', { defaultValue: 'This file is no longer shared with you.' })}>
      <span>
        <Button
          size="small"
          icon={<PaperClipOutlined />}
          disabled={!isAvailable}
          onClick={onDownload}
          aria-label={label}
          style={{ maxWidth: '100%', height: 'auto', padding: '2px 8px', textAlign: 'left' }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word' }}>{attachment.name}</span>{' '}
          <span style={{ color: token.colorTextTertiary, fontSize: 11.5 }}>{formatFileSize(attachment.size)}</span>
        </Button>
      </span>
    </Tooltip>
  );
};

/** The files on a message: images inline, everything else as a chip. Both download on click. */
export const MessageAttachments = ({ attachments }: { attachments: ClientThreadAttachmentV2[] }) => {
  const { t } = useTranslation();
  const { openFile } = useFileAccess();
  if (attachments.length === 0) return null;

  const download = (attachment: ClientThreadAttachmentV2) => {
    if (attachment.file_id) void openFile({ id: attachment.file_id, name: attachment.name }, 'download');
  };

  return (
    <Flex
      vertical
      gap={6}
      align="flex-start"
      role="list"
      aria-label={t('discussions.attachments', { defaultValue: 'Attachments' })}
      style={{ marginTop: 6 }}
    >
      {attachments.map(attachment => (
        <div key={attachment.id} role="listitem" style={{ maxWidth: '100%' }}>
          {isImageAttachment(attachment) && attachment.file_id ? (
            <AttachmentImage attachment={attachment} onDownload={() => download(attachment)} />
          ) : (
            <FileChip attachment={attachment} onDownload={() => download(attachment)} />
          )}
        </div>
      ))}
    </Flex>
  );
};
