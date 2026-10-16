import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Row,
  Tag,
  Typography,
  AuditOutlined,
  CheckOutlined,
  FileTextOutlined,
  FlagOutlined,
  CheckSquareOutlined,
  LockOutlined,
  theme,
} from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import {
  useDecideApprovalMutation,
  useGetApprovalQuery,
  useGetThreadsQuery,
  usePostCommentMutation,
} from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import {
  CommentComposer,
  DetailModal,
  MessageList,
  QueryState,
  RichTextField,
  RichTextView,
  StatusTag,
  errorCode,
  errorMessage,
  isRichTextEmpty,
  richTextToPlain,
  useRoleLabel,
} from '@/components/v2';
import type { ClientApprovalDetailV2 } from '@/types/v2';

const LINK_ICONS = {
  file: <FileTextOutlined />,
  milestone: <FlagOutlined />,
  task: <CheckSquareOutlined />,
  freeform: <AuditOutlined />,
} as const;

/** One approval in a dialog over the list: what is being approved, the decision card, history and a discussion (spec #2522). */
export const ApprovalDetail: React.FC<{ id: string | undefined; onClose: () => void }> = ({ id, onClose }) => {
  const { t } = useTranslation();
  const query = useGetApprovalQuery(id ?? '', { skip: !id });

  return (
    <DetailModal open={Boolean(id)} onClose={onClose} title={t('approvals.title', { defaultValue: 'Approvals' })}>
      <QueryState
        {...query}
        refetch={query.refetch}
        onBack={onClose}
        backLabel={t('approvals.backToApprovals', { defaultValue: 'Back to approvals' })}
      >
        {query.data && <ApprovalBody approval={query.data} />}
      </QueryState>
    </DetailModal>
  );
};

const ApprovalBody: React.FC<{ approval: ClientApprovalDetailV2 }> = ({ approval }) => {
  const { t } = useTranslation();
  const message = useMessage();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { can, me } = useClientAccess();
  const roleLabelOf = useRoleLabel();
  const { date, dateTime } = useFormatters();
  const [decide] = useDecideApprovalMutation();
  const [postComment] = usePostCommentMutation();
  const { data: threads } = useGetThreadsQuery({ projectId: approval.project_id });

  const [comment, setComment] = useState('');
  // "Request changes" without a comment asks once before it records an empty one.
  const [nudge, setNudge] = useState(false);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    inFlight.current = false;
    setComment('');
    setNudge(false);
    setPending(false);
  }, [approval.id]);

  const link = approval.linked_item;
  const awaiting = approval.status === 'awaiting';
  const fileMoved =
    link.type === 'file' && link.available && link.file_version !== null && link.current_file_version != null && link.current_file_version > link.file_version;
  const thread = threads?.find(x => x.context.type === 'approval' && x.context.ref_id === approval.id);
  const history = [...approval.history].sort((a, b) => b.at.localeCompare(a.at));

  const submit = async (outcome: 'approved' | 'changes_requested') => {
    // One decision per request: guard against a double click before the server answers.
    if (inFlight.current || !awaiting || !approval.can_decide) return;
    if (outcome === 'changes_requested' && isRichTextEmpty(comment) && !nudge) {
      setNudge(true);
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const result = await decide({
        id: approval.id,
        outcome,
        comment: isRichTextEmpty(comment) ? '' : comment,
        confirmEmpty: outcome === 'changes_requested' && isRichTextEmpty(comment),
      }).unwrap();
      if (!result.recorded) {
        void message.info(t('approvals.alreadyRecorded', { defaultValue: 'A decision was already recorded for this approval.' }));
      } else if (outcome === 'approved') {
        void message.success(
          t('approvals.approvedToast', {
            item: link.file_version ? `${link.name} v${link.file_version}` : link.name,
            defaultValue: 'Approved. Your team is notified and {{item}} is recorded as approved.',
          })
        );
      } else {
        void message.success(t('approvals.changesToast', { defaultValue: 'Changes requested. Your team is notified and will send a new revision.' }));
      }
    } catch (error) {
      inFlight.current = false;
      if (errorCode(error) === 'COMMENT_REQUIRED') setNudge(true);
      else void message.error(errorMessage(error) ?? t('approvals.decideFailed', { defaultValue: 'We could not record your decision. Please try again.' }));
    } finally {
      setPending(false);
    }
  };

  const sendComment = async (text: string) => {
    try {
      await postComment({ project_id: approval.project_id, context: { type: 'approval', ref_id: approval.id }, text }).unwrap();
      void message.success(t('discussions.posted', { defaultValue: 'Comment posted. Your team is notified.' }));
    } catch (error) {
      void message.error(errorMessage(error) ?? t('discussions.postFailed', { defaultValue: 'We could not post your comment. Please try again.' }));
      throw error;
    }
  };

  const openLinked = () => {
    if (!link.id) return;
    if (link.type === 'file') navigate(`/projects/${approval.project_id}/files?file=${link.id}`);
    if (link.type === 'milestone') navigate(`/projects/${approval.project_id}/milestones?ms=${link.id}`);
    if (link.type === 'task') navigate(`/projects/${approval.project_id}/tasks?task=${link.id}`);
  };

  const roleLabel = roleLabelOf(me?.role);

  return (
    <div>
      <Flex justify="space-between" align="flex-start" gap={12} wrap="wrap" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {approval.title}
          </Typography.Title>
          <Typography.Text type="secondary">
            {approval.ref_no} · {approval.project_name} · {t('approvals.revision', { count: approval.revision, defaultValue: 'Revision {{count}}' })}
          </Typography.Text>
        </div>
        <StatusTag kind="approval" status={approval.status} />
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title={t('approvals.whatYouApprove', { defaultValue: 'What you are approving' })} style={{ marginBottom: 16 }}>
            <Flex
              justify="space-between"
              align="center"
              gap={10}
              style={{ padding: '10px 12px', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG }}
            >
              <Flex gap={10} align="center">
                <span aria-hidden style={{ fontSize: 18 }}>{LINK_ICONS[link.type]}</span>
                <div>
                  <Typography.Text strong style={{ display: 'block' }}>{link.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {link.type === 'file'
                      ? t('approvals.versionN', { version: link.file_version, defaultValue: 'Version {{version}}' })
                      : link.type === 'task'
                        ? t('approvals.linkType.task', { defaultValue: 'Task' })
                        : link.type === 'freeform'
                          ? t('approvals.linkType.freeform', { defaultValue: 'Details from your team' })
                          : t('approvals.linkType.milestone', { defaultValue: 'Milestone' })}
                  </Typography.Text>
                </div>
              </Flex>
              {link.type !== 'freeform' &&
                (link.available ? (
                  <Button size="small" onClick={openLinked}>
                    {link.type === 'file'
                      ? t('approvals.openFile', { defaultValue: 'Open file' })
                      : link.type === 'task'
                        ? t('approvals.openTask', { defaultValue: 'Open task' })
                        : t('approvals.openMilestone', { defaultValue: 'Open milestone' })}
                  </Button>
                ) : (
                  <Tag icon={<LockOutlined />}>{t('approvals.noLongerShared', { defaultValue: 'No longer shared' })}</Tag>
                ))}
            </Flex>

            {link.type === 'freeform' && (
              <div style={{ marginTop: 10 }}>
                {link.description ? (
                  <div style={{ lineHeight: 1.6 }}>
                    <RichTextView value={link.description} />
                  </div>
                ) : (
                  <Typography.Text type="secondary">
                    {t('approvals.noDescription', { defaultValue: 'Your team did not add a description. See the instructions below.' })}
                  </Typography.Text>
                )}
                {approval.earlier_revisions.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                    <Typography.Text type="secondary" strong style={{ fontSize: token.fontSizeSM }}>
                      {t('approvals.earlierRevisions', { defaultValue: 'EARLIER REVISIONS' })}
                    </Typography.Text>
                    {approval.earlier_revisions.map(item => (
                      <div key={item.revision} style={{ fontSize: token.fontSizeSM, marginTop: 4 }}>
                        <b>{t('approvals.revision', { count: item.revision, defaultValue: 'Revision {{count}}' })}:</b>{' '}
                        {richTextToPlain(item.description) || t('approvals.noDescriptionShort', { defaultValue: 'No description.' })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {fileMoved && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 10 }}
                message={t('approvals.fileMoved', {
                  approved: link.file_version,
                  current: link.current_file_version,
                  defaultValue: 'This approval covers v{{approved}}. The file is now v{{current}}, so your decision applies to the earlier version.',
                })}
              />
            )}

            <Typography.Text type="secondary" strong style={{ display: 'block', margin: '16px 0 6px', fontSize: token.fontSizeSM }}>
              {t('approvals.instructions', { defaultValue: 'INSTRUCTIONS' })}
            </Typography.Text>
            <div style={{ lineHeight: 1.6 }}>
              {approval.instructions ? (
                <RichTextView value={approval.instructions} />
              ) : (
                <Typography.Text>{t('approvals.noInstructions', { defaultValue: 'No instructions were added.' })}</Typography.Text>
              )}
            </div>
            <Flex gap={18} wrap="wrap" style={{ marginTop: 14 }}>
              {approval.requested_by && (
                <Typography.Text type="secondary">{t('approvals.requestedBy', { name: approval.requested_by, defaultValue: 'Requested by {{name}}' })}</Typography.Text>
              )}
              {approval.approver_name && (
                <Typography.Text type="secondary">{t('approvals.approver', { name: approval.approver_name, defaultValue: 'Approver: {{name}}' })}</Typography.Text>
              )}
              {approval.due_date && (
                <Typography.Text type="secondary">{t('approvals.dueOn', { date: date(approval.due_date), defaultValue: 'Due {{date}}' })}</Typography.Text>
              )}
            </Flex>
          </Card>

          {approval.decision && (
            <Card
              title={t('approvals.decisionCard', { defaultValue: 'Decision' })}
              style={{ marginBottom: 16, borderColor: approval.decision.outcome === 'approved' ? token.colorSuccessBorder : token.colorErrorBorder }}
            >
              <Typography.Text strong>
                {approval.decision.outcome === 'approved'
                  ? t('approvals.approvedBy', { name: approval.decision.decided_by, defaultValue: 'Approved by {{name}}' })
                  : t('approvals.changesBy', { name: approval.decision.decided_by, defaultValue: 'Changes requested by {{name}}' })}
              </Typography.Text>
              <Typography.Text type="secondary"> · {dateTime(approval.decision.decided_at)}</Typography.Text>
              {approval.decision.comment && (
                <div style={{ marginTop: 6 }}>
                  <RichTextView value={approval.decision.comment} />
                </div>
              )}
              <Typography.Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM, marginTop: 8 }}>
                {t('approvals.decisionFinal', { defaultValue: 'A decision is final. Changing it needs a new revision from your team.' })}
              </Typography.Text>
            </Card>
          )}

          {awaiting && (
            <Card title={t('approvals.yourDecision', { defaultValue: 'Your decision' })} style={{ marginBottom: 16 }}>
              {approval.can_decide ? (
                <>
                  <RichTextField
                    value={comment}
                    maxLength={2000}
                    minHeight={72}
                    ariaLabel={t('approvals.commentLabel', { defaultValue: 'Decision comment' })}
                    placeholder={t('approvals.commentPlaceholder', { defaultValue: 'Add a comment (optional, but helpful if you request changes)' })}
                    onChange={value => {
                      setComment(value);
                      setNudge(false);
                    }}
                  />
                  {nudge && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginTop: 10 }}
                      message={t('approvals.nudge', {
                        defaultValue:
                          'Tell your team what to change. A comment is optional, but it saves a round of questions. Add one, or choose “Request changes without a comment”.',
                      })}
                    />
                  )}
                  <Flex gap={10} style={{ marginTop: 12 }}>
                    <Button type="primary" icon={<CheckOutlined />} disabled={pending} onClick={() => void submit('approved')}>
                      {t('approvals.approve', { defaultValue: 'Approve' })}
                    </Button>
                    <Button disabled={pending} onClick={() => void submit('changes_requested')}>
                      {nudge
                        ? t('approvals.changesNoComment', { defaultValue: 'Request changes without a comment' })
                        : t('approvals.requestChanges', { defaultValue: 'Request changes' })}
                    </Button>
                  </Flex>
                </>
              ) : (
                <>
                  <Alert
                    type="info"
                    showIcon
                    icon={<LockOutlined />}
                    style={{ marginBottom: 12 }}
                    message={
                      !can.approve
                        ? t('approvals.cannotRole', {
                            role: roleLabel,
                            defaultValue: 'As a {{role}} you can view this approval but not decide it. Only a Client Admin can approve.',
                          })
                        : t('approvals.cannotNotApprover', {
                            name: approval.approver_name ?? '',
                            defaultValue: 'Only {{name}} was asked to decide this approval. You can follow along here.',
                          })
                    }
                  />
                  <Flex gap={10}>
                    <Button type="primary" disabled>
                      {t('approvals.approve', { defaultValue: 'Approve' })}
                    </Button>
                    <Button disabled>{t('approvals.requestChanges', { defaultValue: 'Request changes' })}</Button>
                  </Flex>
                </>
              )}
            </Card>
          )}

          <Card title={t('approvals.discussion', { defaultValue: 'Discussion about this approval' })}>
            <MessageList
              messages={thread?.messages ?? []}
              emptyText={t('approvals.noComments', { defaultValue: 'No comments yet. Ask your team a question here before you decide.' })}
            />
            <CommentComposer
              canComment={can.comment}
              placeholder={t('approvals.commentOn', { defaultValue: 'Comment on this approval…' })}
              lockedText={t('locked.comment', { defaultValue: "Client Viewers can't comment." })}
              onSend={sendComment}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={t('approvals.history', { defaultValue: 'History' })}>
            {history.map((entry, index) => (
              <div key={`${entry.at}-${index}`} style={{ padding: '8px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <div style={{ fontSize: token.fontSizeSM }}>
                  <b>{entry.actor}</b> {entry.text}
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {dateTime(entry.at)}
                </Typography.Text>
              </div>
            ))}
            {history.length === 0 && (
              <Typography.Text type="secondary">{t('approvals.noHistory', { defaultValue: 'No history yet.' })}</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
