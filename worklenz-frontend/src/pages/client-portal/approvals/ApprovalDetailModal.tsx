import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckSquareOutlined,
  EditOutlined,
  FileTextOutlined,
  FlagOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Flex, Form, Modal, Result, Row, Timeline, Typography, message, theme } from '@/shared/antd-imports';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useCancelApprovalMutation,
  useGetApprovalQuery,
  useResubmitApprovalMutation,
  useSendApprovalMutation,
} from '@/api/client-portal/portal-workflow-api';
import {
  ApprovalStatusTag,
  ConfirmEffectModal,
  StatusTag,
  formatPortalDate,
  formatPortalDateTime,
} from '@/components/client-portal/v2';
import type { Approval, ApprovalLinkType } from '@/types/client-portal/v2';
import { ProjectTab, portalPaths } from '../portal-paths';
import { useModalRouteClose } from '../useModalRouteClose';
import { PortalLoader } from '@/components/client-portal/v2';
import { RichTextField } from '../shared/rich-text/RichTextField';
import { RichTextView } from '../shared/rich-text/RichTextView';

const LINK_ICONS: Record<ApprovalLinkType, ReactNode> = {
  file: <FileTextOutlined />,
  task: <CheckSquareOutlined />,
  milestone: <FlagOutlined />,
  freeform: <EditOutlined />,
};

const LINK_PROJECT_TAB: Record<Exclude<ApprovalLinkType, 'freeform'>, ProjectTab> = {
  file: 'files',
  task: 'tasks',
  milestone: 'milestones',
};

/** One approval: the item and version it covers, the client's decision, the history, and the next action. */
export const ApprovalDetailModal = () => {
  const { t, i18n } = useTranslation('client-portal-v2-approvals');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { approvalId = '' } = useParams<{ approvalId: string }>();
  const close = useModalRouteClose(portalPaths.approvals);

  const query = useGetApprovalQuery(approvalId, { skip: !approvalId });
  const [sendApproval, { isLoading: isSending }] = useSendApprovalMutation();
  const [cancelApproval, { isLoading: isCancelling }] = useCancelApprovalMutation();
  const [resubmitApproval, { isLoading: isResubmitting }] = useResubmitApprovalMutation();

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseDescription, setReviseDescription] = useState('');

  const approval = query.data?.body;

  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      message.success(success);
    } catch (error) {
      message.error(getPortalErrorMessage(error, failure));
    }
  };

  const send = (item: Approval) =>
    run(
      () => sendApproval(item.id).unwrap(),
      t('detail.sent', { ref: item.ref_no, approver: item.approver_name, defaultValue: '{{ref}} sent. {{approver}} is notified.' }),
      t('detail.sendFailed', { defaultValue: 'The approval could not be sent.' })
    );

  const cancel = async (item: Approval) => {
    await run(
      () => cancelApproval(item.id).unwrap(),
      t('detail.cancelled', {
        ref: item.ref_no,
        defaultValue: '{{ref}} cancelled. It disappears from the client’s pending actions.',
      }),
      t('detail.cancelFailed', { defaultValue: 'The approval could not be cancelled.' })
    );
    setConfirmCancel(false);
  };

  const resubmit = async (item: Approval, description?: string) => {
    await run(
      () => resubmitApproval({ approvalId: item.id, body: description !== undefined ? { description } : undefined }).unwrap(),
      t('detail.resubmitted', {
        ref: item.ref_no,
        revision: item.revision + 1,
        approver: item.approver_name,
        defaultValue:
          '{{ref}} is awaiting approval again as revision {{revision}}. {{approver}} is notified. The previous decision is preserved.',
      }),
      t('detail.resubmitFailed', { defaultValue: 'The approval could not be resubmitted.' })
    );
    setReviseOpen(false);
  };

  const startResubmit = (item: Approval) => {
    if (item.linked_item.type === 'freeform') {
      // A free-form item has no record to refresh, so the new description is entered here.
      setReviseDescription(item.linked_item.description ?? '');
      setReviseOpen(true);
    } else {
      void resubmit(item);
    }
  };

  const renderBody = (item: Approval) => {
    const linked = item.linked_item;
    const subline =
      linked.type === 'file'
        ? t('detail.linkFile', { version: linked.file_version ?? 0, defaultValue: 'File · version {{version}} recorded' })
        : linked.type === 'task'
          ? t('detail.linkTask', { key: linked.task_key ?? '', defaultValue: 'Task · {{key}}' })
          : linked.type === 'freeform'
            ? t('detail.linkFreeform', { defaultValue: 'Free-form item · not linked to a record' })
            : t('detail.linkMilestone', { defaultValue: 'Milestone' });

    return (
      <Row gutter={[20, 16]}>
        <Col xs={24} md={15}>
          <Typography.Title level={5} style={{ margin: '0 0 2px' }}>
            {decodeHtmlEntities(item.title)}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>
            {item.organization_name} · {decodeHtmlEntities(item.project_name)}
          </Typography.Text>

          <Card size="small" style={{ marginBottom: 12 }} title={t('detail.linkedItem', { defaultValue: 'Linked item' })}>
            <Flex justify="space-between" align="center" gap={10} wrap="wrap">
              <Flex align="center" gap={10}>
                <span style={{ fontSize: 18, color: token.colorTextSecondary }}>{LINK_ICONS[linked.type]}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{decodeHtmlEntities(linked.name)}</div>
                  <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>{subline}</div>
                </div>
              </Flex>
              {linked.type !== 'freeform' && (
                <Button
                  size="small"
                  onClick={() => navigate(portalPaths.project(item.project_id, LINK_PROJECT_TAB[linked.type as Exclude<ApprovalLinkType, 'freeform'>]))}
                >
                  {t('detail.openItem', { defaultValue: 'Open item' })}
                </Button>
              )}
            </Flex>

            {linked.type === 'freeform' && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                {linked.description ? (
                  <RichTextView value={linked.description} />
                ) : (
                  <Typography.Text type="secondary">{t('detail.noDescription', { defaultValue: 'No description.' })}</Typography.Text>
                )}
                {item.earlier_revisions.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11.5, marginBottom: 4 }}>
                      {t('detail.earlierRevisions', { defaultValue: 'Earlier revisions' })}
                    </Typography.Text>
                    {item.earlier_revisions.map(revision => (
                      <div key={revision.revision} style={{ fontSize: 12.5, marginBottom: 4, color: token.colorTextSecondary }}>
                        <strong>
                          {t('detail.revisionLabel', { revision: revision.revision, defaultValue: 'Revision {{revision}}:' })}
                        </strong>{' '}
                        {revision.description || t('detail.noDescription', { defaultValue: 'No description.' })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {item.newer_file_version !== null && linked.file_version !== null && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 10 }}
                message={t('detail.newerVersion', {
                  approved: linked.file_version,
                  current: item.newer_file_version,
                  defaultValue:
                    'This approval covers v{{approved}}. The file has since moved to v{{current}}. The approval still points at v{{approved}}; request a new revision to cover the newer version.',
                })}
              />
            )}
          </Card>

          <Card size="small" style={{ marginBottom: 12 }} title={t('detail.instructions', { defaultValue: 'Instructions for the client' })}>
            {item.instructions ? (
              <RichTextView value={item.instructions} />
            ) : (
              <Typography.Text type="secondary">{t('detail.noInstructions', { defaultValue: 'No instructions.' })}</Typography.Text>
            )}
          </Card>

          {item.decision && (
            <Card
              size="small"
              style={{ marginBottom: 12, borderColor: item.decision.outcome === 'approved' ? token.colorSuccessBorder : token.colorErrorBorder }}
              title={t('detail.decision', { defaultValue: 'Client decision' })}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {item.decision.outcome === 'approved'
                  ? t('detail.approvedBy', { name: item.decision.decided_by, defaultValue: 'Approved by {{name}}' })
                  : t('detail.changesBy', { name: item.decision.decided_by, defaultValue: 'Changes requested by {{name}}' })}{' '}
                <span style={{ color: token.colorTextTertiary, fontWeight: 400 }}>
                  · {formatPortalDateTime(item.decision.decided_at, i18n.language)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 4 }}>{item.decision.reference}</div>
              {item.decision.comment && <div style={{ fontSize: 13, marginTop: 6 }}>“{item.decision.comment}”</div>}
            </Card>
          )}
        </Col>

        <Col xs={24} md={9}>
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 14 }}>
            <Descriptions.Item label={t('detail.approver', { defaultValue: 'Approver' })}>{item.approver_name}</Descriptions.Item>
            <Descriptions.Item label={t('detail.due', { defaultValue: 'Due' })}>
              {item.due_date ? (
                <Typography.Text type={item.is_overdue ? 'danger' : undefined}>
                  {formatPortalDate(item.due_date, i18n.language)}
                  {item.is_overdue ? ` · ${t('detail.overdue', { defaultValue: 'overdue' })}` : ''}
                </Typography.Text>
              ) : (
                t('detail.noDueDate', { defaultValue: 'No due date' })
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('detail.createdBy', { defaultValue: 'Created by' })}>{item.created_by}</Descriptions.Item>
            <Descriptions.Item label={t('detail.visibleToClient', { defaultValue: 'Visible to client' })}>
              {item.visible_to_client
                ? t('detail.yes', { defaultValue: 'Yes' })
                : t('detail.noDraft', { defaultValue: 'No (draft)' })}
            </Descriptions.Item>
          </Descriptions>

          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('detail.history', { defaultValue: 'History' })}
          </Typography.Text>
          <Timeline
            items={[...item.history].reverse().map((entry, index) => ({
              key: `${entry.at}-${index}`,
              dot: entry.side === 'client' ? <UserOutlined /> : <SafetyOutlined />,
              children: (
                <div>
                  <div style={{ fontSize: 12.5 }}>
                    <strong>{entry.actor}</strong>{' '}
                    <StatusTag tone={entry.side === 'client' ? 'purple' : 'gray'}>
                      {entry.side === 'client'
                        ? t('detail.sideClient', { defaultValue: 'Client' })
                        : t('detail.sideInternal', { defaultValue: 'Internal' })}
                    </StatusTag>{' '}
                    {entry.text}
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{formatPortalDateTime(entry.at, i18n.language)}</div>
                </div>
              ),
            }))}
          />
        </Col>
      </Row>
    );
  };

  const renderFooter = (item: Approval) => (
    <Flex gap={8} justify="flex-end" wrap="wrap">
      <Button onClick={close}>{t('detail.close', { defaultValue: 'Close' })}</Button>
      {item.discussion && (
        <Button onClick={() => navigate(portalPaths.discussion(item.discussion!.thread_id))}>
          {t('detail.openDiscussion', { count: item.discussion.message_count, defaultValue: 'Open discussion ({{count}})' })}
        </Button>
      )}
      {item.status === 'draft' && (
        <Button type="primary" loading={isSending} onClick={() => void send(item)}>
          {t('detail.sendToClient', { defaultValue: 'Send to client' })}
        </Button>
      )}
      {item.status === 'awaiting' && (
        <Button onClick={() => setConfirmCancel(true)}>{t('detail.cancelRequest', { defaultValue: 'Cancel request' })}</Button>
      )}
      {item.status === 'changes_requested' && (
        <Button type="primary" loading={isResubmitting} onClick={() => startResubmit(item)}>
          {t('detail.resubmit', { defaultValue: 'Resubmit as new revision' })}
        </Button>
      )}
      {item.status === 'approved' && (
        <Button loading={isResubmitting} onClick={() => startResubmit(item)}>
          {t('detail.reapprove', { defaultValue: 'Request re-approval (new revision)' })}
        </Button>
      )}
    </Flex>
  );

  return (
    <>
      <Modal
        open
        onCancel={close}
        width={800}
        destroyOnHidden
        footer={approval ? renderFooter(approval) : null}
        title={
          approval ? (
            <Flex align="center" gap={10} wrap="wrap">
              {approval.ref_no}
              <ApprovalStatusTag status={approval.status} />
              <StatusTag tone="gray">
                {t('detail.revision', { revision: approval.revision, defaultValue: 'Revision {{revision}}' })}
              </StatusTag>
            </Flex>
          ) : (
            t('detail.loadingTitle', { defaultValue: 'Approval' })
          )
        }
      >
        {query.isLoading ? (
          <PortalLoader />
        ) : query.isError || !approval ? (
          <Result
            status={(query.error as { status?: number } | undefined)?.status === 404 ? '404' : 'error'}
            title={t('detail.loadFailed', { defaultValue: 'Could not load this approval' })}
            extra={
              <Button type="primary" onClick={() => query.refetch()}>
                {t('retry', { defaultValue: 'Retry' })}
              </Button>
            }
          />
        ) : (
          renderBody(approval)
        )}
      </Modal>

      {approval && (
        <>
          <Modal
            open={reviseOpen}
            onCancel={() => setReviseOpen(false)}
            width={540}
            destroyOnHidden
            title={t('detail.reviseTitle', {
              revision: approval.revision + 1,
              ref: approval.ref_no,
              defaultValue: 'Revision {{revision}} of {{ref}}',
            })}
            okText={t('detail.reviseSubmit', { defaultValue: 'Resubmit for approval' })}
            cancelText={t('detail.close', { defaultValue: 'Close' })}
            okButtonProps={{ loading: isResubmitting, disabled: reviseDescription.trim() === '' }}
            onOk={() => void resubmit(approval, reviseDescription.trim())}
          >
            <Form layout="vertical">
              <Form.Item
                label={t('detail.reviseDescription', { defaultValue: 'Description for the client' })}
                extra={t('detail.reviseHint', {
                  revision: approval.revision,
                  approver: approval.approver_name,
                  defaultValue:
                    'The current description is kept as revision {{revision}}. {{approver}} is notified by email and in the portal.',
                })}
              >
                <RichTextField
                  value={reviseDescription}
                  onChange={html => setReviseDescription(html)}
                  ariaLabel={t('detail.reviseDescription', { defaultValue: 'Description for the client' })}
                  maxLength={2000}
                  minHeight={140}
                />
              </Form.Item>
            </Form>
          </Modal>

          <ConfirmEffectModal
            open={confirmCancel}
            danger
            title={t('detail.cancelTitle', { defaultValue: 'Cancel this approval request?' })}
            confirmLabel={t('detail.cancelConfirm', { defaultValue: 'Cancel request' })}
            loading={isCancelling}
            onClose={() => setConfirmCancel(false)}
            onConfirm={() => void cancel(approval)}
          >
            {t('detail.cancelBody', {
              ref: approval.ref_no,
              approver: approval.approver_name,
              defaultValue: '{{ref}} is withdrawn and {{approver}} no longer sees it as pending. The history is kept.',
            })}
          </ConfirmEffectModal>
        </>
      )}
    </>
  );
};
