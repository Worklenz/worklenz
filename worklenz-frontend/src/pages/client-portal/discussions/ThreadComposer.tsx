import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOutlined, LockOutlined } from '@ant-design/icons';
import { Button, Flex, message, theme } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { usePostThreadMessageMutation } from '@/api/client-portal/portal-workflow-api';
import type { MentionOption, MessageVisibility } from '@/types/client-portal/v2';
import { AttachButton, AttachmentChips } from './AttachmentPicker';
import { RichMessageEditor, type RichMessageChange } from './RichMessageEditor';
import { useMessageAttachments } from './useMessageAttachments';

const MAX_MESSAGE_LENGTH = 4000;

interface ThreadComposerProps {
  threadId: string;
  /** Files are uploaded to this project before the message is sent. */
  projectId: string;
  /** Active client users on the project: who a client-visible reply can mention, and who it reaches. */
  audience: MentionOption[];
  /** Active project members: who an internal comment can mention. */
  members?: MentionOption[];
}

/**
 * Reply to the client or leave an internal comment. The toggle and the audience line next to it say,
 * before sending, exactly who will see the message. The message is rich text (headings, bold, italic,
 * lists, links). Typing @ suggests client users on a client-visible reply and project members on an
 * internal comment; the two are never mixed.
 */
export const ThreadComposer = ({ threadId, projectId, audience, members = [] }: ThreadComposerProps) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const { token } = theme.useToken();
  const [visibility, setVisibility] = useState<MessageVisibility>('client');
  const [draft, setDraft] = useState<RichMessageChange>({ html: '', text: '', mentionIds: [] });
  const [postMessage, { isLoading }] = usePostThreadMessageMutation();

  const isInternal = visibility === 'internal';
  const suggestions = isInternal ? members : audience;
  const firstNames = audience.map(user => user.name.split(' ')[0]);
  // The ids come from the @ chips that are really in the message, so two people with the same name
  // stay apart and a deleted chip is not sent.
  const mentioned = suggestions.filter(person => draft.mentionIds.includes(person.id));
  const attachments = useMessageAttachments(projectId);
  const hasText = draft.text.trim().length > 0;
  // A message can be only files, but not while one is still uploading.
  const canSend = (hasText || attachments.fileIds.length > 0) && !attachments.isUploading;
  const isTooLong = draft.text.length > MAX_MESSAGE_LENGTH;

  const send = async () => {
    const text = draft.html;
    if (!canSend || isTooLong || isLoading) return;

    const mentionIds = mentioned.map(person => person.id);
    const mentionField = isInternal ? 'mention_user_ids' : 'mention_ids';

    try {
      const result = await postMessage({
        threadId,
        body: {
          visibility,
          text,
          ...(mentionIds.length > 0 ? { [mentionField]: mentionIds } : {}),
          ...(attachments.fileIds.length > 0 ? { attachment_file_ids: attachments.fileIds } : {}),
        },
      }).unwrap();
      setDraft({ html: '', text: '', mentionIds: [] });
      attachments.reset();

      if (isInternal) {
        message.success(t('composer.internalSaved', { defaultValue: 'Internal comment saved. The client cannot see it.' }));
      } else {
        const notified = result.body?.notified ?? [];
        message.success(
          notified.length > 0
            ? t('composer.sentNotified', {
                names: notified.join(', '),
                defaultValue: 'Reply sent. {{names}} notified.',
              })
            : t('composer.sent', { defaultValue: 'Reply sent.' })
        );
      }
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('composer.failed', { defaultValue: 'The message could not be sent.' })));
    }
  };

  const placeholder = isInternal
    ? t('composer.placeholderInternal', { defaultValue: 'Add an internal comment… Type @ to mention a team member' })
    : t('composer.placeholderClient', { defaultValue: 'Reply to the client… Type @ to mention someone' });

  return (
    <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, padding: '10px 16px 12px' }}>
      <Flex align="center" justify="space-between" gap={10} wrap="wrap" style={{ marginBottom: 8 }}>
        <PillToggle<MessageVisibility>
          value={visibility}
          onChange={setVisibility}
          ariaLabel={t('composer.audienceLabel', { defaultValue: 'Who can see this message' })}
          options={[
            { value: 'client', label: t('composer.clientVisible', { defaultValue: 'Client visible' }) },
            { value: 'internal', label: t('composer.internalComment', { defaultValue: 'Internal comment' }) },
          ]}
        />
        <span
          style={{
            fontSize: 11.5,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: isInternal ? token.colorWarning : token.colorTextSecondary,
          }}
        >
          {isInternal ? <LockOutlined aria-hidden /> : <EyeOutlined aria-hidden />}
          {isInternal
            ? t('composer.audienceInternal', { defaultValue: 'Only your team can see this' })
            : mentioned.length > 0
              ? t('composer.audienceMentioned', {
                  names: mentioned.map(user => user.name.split(' ')[0]).join(', '),
                  defaultValue: 'Visible to everyone on the project. Only {{names}} will be notified.',
                })
              : audience.length > 0
              ? t('composer.audienceClient', {
                  names: firstNames.join(', '),
                  defaultValue: 'Visible to {{names}} and your team',
                })
              : t('composer.audienceNone', { defaultValue: 'Visible to your team. No active client users on this project.' })}
        </span>
      </Flex>

      <Flex gap={8} align="flex-end">
        <RichMessageEditor
          value={draft.html}
          onChange={setDraft}
          mentionOptions={suggestions}
          onSubmit={() => void send()}
          placeholder={placeholder}
          ariaLabel={placeholder}
          tone={isInternal ? 'internal' : 'default'}
        />
        <AttachButton controller={attachments} disabled={isLoading} />
        <Button type="primary" disabled={!canSend || isTooLong} loading={isLoading} onClick={() => void send()}>
          {t('composer.send', { defaultValue: 'Send' })}
        </Button>
      </Flex>
      <AttachmentChips controller={attachments} />
      {!isInternal && attachments.fileIds.length > 0 && (
        <div role="note" style={{ fontSize: 11.5, marginTop: 4, color: token.colorWarning }}>
          {t('composer.attachSharedNote', {
            defaultValue: 'Attached files are shared with the client (the attached version only) and appear in the project Files.',
          })}
        </div>
      )}
      <div
        style={{
          fontSize: 11.5,
          marginTop: 4,
          color: isTooLong ? token.colorError : token.colorTextTertiary,
        }}
      >
        {isTooLong
          ? t('composer.tooLong', {
              max: MAX_MESSAGE_LENGTH,
              defaultValue: 'A message can be at most {{max}} characters.',
            })
          : t('composer.sendHint', { defaultValue: 'Press Ctrl+Enter to send' })}
      </div>
    </div>
  );
};
