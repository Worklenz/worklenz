import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PaperClipOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip, message, theme } from '@/shared/antd-imports';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useGetFileDownloadLinkMutation } from '@/api/client-portal/portal-projects-api';
import { formatFileSize } from '@/components/client-portal/v2/file-rules';
import type { ThreadAttachment } from '@/types/client-portal/v2';

const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);

/** SVG is left out on purpose: it can carry script, so it is offered as a download like any other file. */
export const isImageAttachment = (attachment: ThreadAttachment): boolean => {
  const extension = attachment.type || (attachment.name.includes('.') ? attachment.name.split('.').pop() ?? '' : '');
  return IMAGE_TYPES.has(extension.toLowerCase());
};

const useAttachmentDownload = () => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const [getDownloadLink] = useGetFileDownloadLinkMutation();

  return async (attachment: ThreadAttachment) => {
    if (!attachment.file_id) return;
    try {
      const result = await getDownloadLink({ fileId: attachment.file_id }).unwrap();
      if (result.body?.url) window.open(result.body.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('thread.downloadFailed', { defaultValue: 'The download link could not be created.' }))
      );
    }
  };
};

/** An image shown in the message. Click it to download the original. */
const AttachmentImage = ({ attachment, onDownload }: { attachment: ThreadAttachment; onDownload: () => void }) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const { token } = theme.useToken();
  const [getDownloadLink] = useGetFileDownloadLinkMutation();
  const [src, setSrc] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    if (!attachment.file_id) return undefined;
    getDownloadLink({ fileId: attachment.file_id })
      .unwrap()
      .then(result => {
        if (isCurrent) setSrc(result.body?.url ?? null);
      })
      .catch(() => {
        if (isCurrent) setHasFailed(true);
      });
    return () => {
      isCurrent = false;
    };
  }, [attachment.file_id, getDownloadLink]);

  // While the link loads, or if it cannot be made, the file is still reachable as a named button.
  if (!src || hasFailed) return <FileChip attachment={attachment} onDownload={onDownload} />;

  return (
    <Tooltip title={t('thread.downloadAttachment', { name: attachment.name, defaultValue: 'Download {{name}}' })}>
      <button
        type="button"
        onClick={onDownload}
        aria-label={t('thread.downloadAttachment', { name: attachment.name, defaultValue: 'Download {{name}}' })}
        style={{
          padding: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
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
const FileChip = ({ attachment, onDownload }: { attachment: ThreadAttachment; onDownload: () => void }) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const { token } = theme.useToken();
  const isAvailable = attachment.file_id !== null;

  return (
    <Tooltip
      title={
        isAvailable
          ? t('thread.downloadAttachment', { name: attachment.name, defaultValue: 'Download {{name}}' })
          : t('thread.attachmentRemoved', { defaultValue: 'This file was removed from the project.' })
      }
    >
      <Button
        size="small"
        icon={<PaperClipOutlined />}
        disabled={!isAvailable}
        onClick={onDownload}
        aria-label={t('thread.downloadAttachment', { name: attachment.name, defaultValue: 'Download {{name}}' })}
        style={{ maxWidth: '100%', height: 'auto', padding: '2px 8px', textAlign: 'left' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word' }}>{attachment.name}</span>{' '}
        <span style={{ color: token.colorTextTertiary, fontSize: 11.5 }}>{formatFileSize(attachment.size)}</span>
      </Button>
    </Tooltip>
  );
};

/** The files on a message: images inline, everything else as a chip. Both download on click. */
export const MessageAttachments = ({ attachments }: { attachments: ThreadAttachment[] }) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const download = useAttachmentDownload();
  if (attachments.length === 0) return null;

  return (
    <Flex
      vertical
      gap={6}
      align="flex-start"
      role="list"
      aria-label={t('thread.attachments', { defaultValue: 'Attachments' })}
      style={{ marginTop: 6 }}
    >
      {attachments.map(attachment => (
        <div key={attachment.id} role="listitem" style={{ maxWidth: '100%' }}>
          {isImageAttachment(attachment) && attachment.file_id ? (
            <AttachmentImage attachment={attachment} onDownload={() => void download(attachment)} />
          ) : (
            <FileChip attachment={attachment} onDownload={() => void download(attachment)} />
          )}
        </div>
      ))}
    </Flex>
  );
};
