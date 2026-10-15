import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CloseOutlined, EyeOutlined, Flex, LockOutlined, Tag, theme } from '@/shared/antd-imports';
import PillToggle from '@/components/PillToggle';
import { useMessage } from '@/hooks/useMessage';
import { useEditMessageMutation, useGetMentionOptionsQuery, usePostCommentMutation } from '@/store/api-v2';
import type { ClientThreadMessageV2, MessageVisibilityV2 } from '@/types/v2';
import { LockedNote, errorMessage } from '@/components/v2';
import { RichTextEditor, type RichTextChange } from '@/components/v2/RichTextEditor';
import { AttachButton, AttachmentChips } from './AttachmentPicker';
import { useMessageAttachments } from './useMessageAttachments';

const MAX_MESSAGE_LENGTH = 4000;
const EMPTY_DRAFT: RichTextChange = { html: '', text: '', mentionIds: [] };

/** The text and people of a stored message, read back from its HTML so an edit keeps its @mention chips. */
const draftFromHtml = (html: string): RichTextChange => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const mentionIds = Array.from(doc.querySelectorAll('[data-type="mention"][data-id]'))
    .map(node => node.getAttribute('data-id') ?? '')
    .filter(Boolean);
  return { html, text: (doc.body.textContent ?? '').trim(), mentionIds: Array.from(new Set(mentionIds)) };
};

const plainSnippet = (html: string): string => {
  const text = draftFromHtml(html).text;
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

interface ThreadComposerProps {
  threadId: string;
  /** Files are uploaded to this project before the message is sent. */
  projectId: string;
  /** Viewers can read a discussion but not reply. */
  canComment: boolean;
  /** Why files can't be attached, or null when they can. */
  attachBlockedReason: string | null;
  /** The message the next send replies to, or null. */
  replyTo?: ClientThreadMessageV2 | null;
  /** The sender's own message being rewritten, or null. */
  editing?: ClientThreadMessageV2 | null;
  /** Drops the reply or edit and returns the composer to a plain reply. */
  onClearContext?: () => void;
}

/**
 * Reply to a discussion. The line beside the editor says who will see the reply before it is sent. The
 * message is rich text (headings, bold, italic, lists, links); typing @ suggests the other people on the
 * project, and a file can be attached where the role and the project allow uploads.
 */
export const ThreadComposer = ({
  threadId,
  projectId,
  canComment,
  attachBlockedReason,
  replyTo = null,
  editing = null,
  onClearContext,
}: ThreadComposerProps) => {
  const { t } = useTranslation();
  const message = useMessage();
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<RichTextChange>(EMPTY_DRAFT);
  const [visibility, setVisibility] = useState<MessageVisibilityV2>('client');
  const [postComment, { isLoading: isPosting }] = usePostCommentMutation();
  const [editMessage, { isLoading: isSaving }] = useEditMessageMutation();
  const isLoading = isPosting || isSaving;
  const { data: people = [] } = useGetMentionOptionsQuery(projectId, { skip: !canComment });
  // A reply to a message the team can't read must not be readable by the team either, and an edit keeps its audience.
  const lockedVisibility: MessageVisibilityV2 | null = editing
    ? (editing.visibility ?? 'client')
    : replyTo?.visibility === 'client_only'
    ? 'client_only'
    : null;
  const isClientOnly = (lockedVisibility ?? visibility) === 'client_only';
  const isEditing = editing !== null;

  // Opening an edit loads the message into the editor; dropping it empties the editor again.
  useEffect(() => {
    setDraft(editing ? draftFromHtml(editing.text) : EMPTY_DRAFT);
  }, [editing]);
  // Files land in the project's Files, which the team can see, so a client-only message carries none.
  const attachments = useMessageAttachments(attachBlockedReason || isClientOnly ? undefined : projectId);

  if (!canComment) {
    return (
      <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, padding: '12px 16px' }}>
        <LockedNote>{t('locked.reply', { defaultValue: "Client Viewers can read discussions but can't reply." })}</LockedNote>
      </div>
    );
  }

  // The ids come from the @ chips that are really in the message, so a deleted chip is not sent.
  const mentioned = people.filter(person => draft.mentionIds.includes(person.id));
  const hasText = draft.text.trim().length > 0;
  // A message can be only files, but not while one is still uploading.
  const canSend = (hasText || (!isEditing && attachments.fileIds.length > 0)) && !attachments.isUploading;
  const isTooLong = draft.text.length > MAX_MESSAGE_LENGTH;

  const send = async () => {
    if (!canSend || isTooLong || isLoading) return;
    try {
      if (editing) {
        await editMessage({
          messageId: editing.id,
          text: draft.html,
          mention_ids: mentioned.map(person => person.id),
        }).unwrap();
        onClearContext?.();
        void message.success(t('discussions.saved', { defaultValue: 'Message updated.' }));
        return;
      }
      await postComment({
        thread_id: threadId,
        text: draft.html,
        ...(isClientOnly ? { visibility: 'client_only' as const } : {}),
        ...(replyTo ? { parent_message_id: replyTo.id } : {}),
        ...(mentioned.length > 0 ? { mention_ids: mentioned.map(person => person.id) } : {}),
        ...(attachments.fileIds.length > 0 ? { attachment_file_ids: attachments.fileIds } : {}),
      }).unwrap();
      setDraft(EMPTY_DRAFT);
      attachments.reset();
      onClearContext?.();
      void message.success(
        isClientOnly
          ? t('discussions.sentClientOnly', { defaultValue: 'Message sent. Only client users on this project can see it.' })
          : t('discussions.sent', { defaultValue: 'Reply sent. Your team is notified.' })
      );
    } catch (error) {
      void message.error(errorMessage(error) ?? t('discussions.postFailed', { defaultValue: 'We could not post your comment. Please try again.' }));
    }
  };

  const placeholder = isClientOnly
    ? t('discussions.replyPlaceholderClientOnly', { defaultValue: 'Write to your colleagues… Type @ to mention someone' })
    : t('discussions.replyPlaceholder', { defaultValue: 'Reply to the team… Type @ to mention someone' });

  return (
    <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, padding: '10px 16px 12px' }}>
      {(replyTo || editing) && (
        <Flex
          align="center"
          justify="space-between"
          gap={8}
          style={{
            marginBottom: 8,
            padding: '4px 10px',
            borderRadius: token.borderRadius,
            background: token.colorFillQuaternary,
            borderInlineStart: `3px solid ${token.colorPrimary}`,
            fontSize: 12,
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {editing
              ? t('discussions.editingMessage', { defaultValue: 'Editing your message' })
              : t('discussions.replyingTo', { name: replyTo?.author, defaultValue: 'Replying to {{name}}' })}
            {replyTo && !editing && <span style={{ color: token.colorTextSecondary }}> · {plainSnippet(replyTo.text)}</span>}
          </span>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onClearContext}
            aria-label={t('discussions.cancelContext', { defaultValue: 'Cancel' })}
          />
        </Flex>
      )}
      <Flex align="center" justify="space-between" gap={10} wrap="wrap" style={{ marginBottom: 8 }}>
        {lockedVisibility ? (
          <Tag
            color={lockedVisibility === 'client_only' ? 'orange' : 'blue'}
            icon={lockedVisibility === 'client_only' ? <LockOutlined /> : <EyeOutlined />}
            style={{ marginInlineEnd: 0 }}
          >
            {lockedVisibility === 'client_only'
              ? t('discussions.clientOnly', { defaultValue: 'Client users only' })
              : t('discussions.teamVisible', { defaultValue: 'Team visible' })}
          </Tag>
        ) : (
          <PillToggle<MessageVisibilityV2>
            value={visibility}
            onChange={setVisibility}
            ariaLabel={t('discussions.audienceLabel', { defaultValue: 'Who can see this message' })}
            options={[
              { value: 'client', label: t('discussions.teamVisible', { defaultValue: 'Team visible' }) },
              { value: 'client_only', label: t('discussions.clientOnly', { defaultValue: 'Client users only' }) },
            ]}
          />
        )}
        <span style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, color: isClientOnly ? token.colorWarning : token.colorTextSecondary }}>
          {isClientOnly ? <LockOutlined aria-hidden /> : <EyeOutlined aria-hidden />}
          {isClientOnly
            ? t('discussions.audienceClientOnly', { defaultValue: 'Only client Members and Admins on this project can see this. Your team cannot.' })
            : mentioned.length > 0
            ? t('discussions.audienceMentioned', {
                names: mentioned.map(person => person.name.split(' ')[0]).join(', '),
                defaultValue: 'Visible to your team and everyone on this project. {{names}} will also be notified.',
              })
            : t('discussions.audience', { defaultValue: 'Visible to your team and everyone on this project' })}
        </span>
      </Flex>

      <Flex gap={8} align="flex-end">
        <RichTextEditor
          value={draft.html}
          onChange={setDraft}
          mentionOptions={people}
          onSubmit={() => void send()}
          placeholder={placeholder}
          ariaLabel={placeholder}
          disabled={isLoading}
          tone={isClientOnly ? 'internal' : 'default'}
          controlled
        />
        <AttachButton
          controller={attachments}
          disabled={isLoading || isClientOnly || isEditing || attachBlockedReason !== null}
          disabledReason={
            isClientOnly
              ? t('discussions.attachClientOnly', { defaultValue: "Files can't be attached to a message your team can't see." })
              : (attachBlockedReason ?? undefined)
          }
        />
        <Button type="primary" disabled={!canSend || isTooLong} loading={isLoading} onClick={() => void send()}>
          {isEditing ? t('discussions.save', { defaultValue: 'Save' }) : t('discussions.send', { defaultValue: 'Send' })}
        </Button>
      </Flex>
      <AttachmentChips controller={attachments} />
      <div style={{ fontSize: 11.5, marginTop: 4, color: isTooLong ? token.colorError : token.colorTextTertiary }}>
        {isTooLong
          ? t('discussions.tooLong', { max: MAX_MESSAGE_LENGTH, defaultValue: 'A message can be at most {{max}} characters.' })
          : t('discussions.sendHint', { defaultValue: 'Press Ctrl+Enter to send' })}
      </div>
    </div>
  );
};
