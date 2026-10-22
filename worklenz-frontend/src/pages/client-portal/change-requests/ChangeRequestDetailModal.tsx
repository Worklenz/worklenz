import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LockOutlined, PaperClipOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  InputNumber,
  Modal,
  Result,
  Select,
  Tabs,
  Timeline,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { useGetPortalStaffQuery } from '@/api/client-portal/portal-access-api';
import { useGetFileDownloadLinkMutation } from '@/api/client-portal/portal-projects-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useApplyChangeRequestActionMutation,
  useGetChangeRequestQuery,
  useUpdateChangeRequestMutation,
} from '@/api/client-portal/portal-workflow-api';
import {
  ChangeRequestStatusTag,
  ConfirmEffectModal,
  PortalAvatar,
  PriorityTag,
  StatusTag,
  formatPortalDate,
  formatPortalDateTime,
} from '@/components/client-portal/v2';
import type { ChangeRequest, ChangeRequestAction, ChangeRequestAttachment, ChangeRequestEstimate } from '@/types/client-portal/v2';
import { formatFileSize } from '@/components/client-portal/v2/file-rules';
import { portalPaths } from '../portal-paths';
import { useModalRouteClose } from '../useModalRouteClose';
import { ChangeRequestStepper } from './ChangeRequestStepper';
import { ConvertToWorkModal } from './ConvertToWorkModal';
import { isBillable, isTerminal } from './cr-helpers';
import { PortalLoader } from '@/components/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { RichTextField } from '../shared/rich-text/RichTextField';
import { RichTextView } from '../shared/rich-text/RichTextView';


/**
 * One change request, in a modal over the list. Status moves only through the explicit actions in the
 * Decision tab, never an inline dropdown. Submitting a request never creates a task by itself: approve
 * it, then convert it to work.
 */
export const ChangeRequestDetailModal = () => {
  const { t, i18n } = useTranslation('client-portal-v2-change-requests');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { changeRequestId = '' } = useParams<{ changeRequestId: string }>();
  const [searchParams] = useSearchParams();
  const close = useModalRouteClose(portalPaths.changeRequests);

  const query = useGetChangeRequestQuery(changeRequestId, { skip: !changeRequestId });
  const staffQuery = useGetPortalStaffQuery();
  const [getDownloadLink] = useGetFileDownloadLinkMutation();
  const [applyAction, { isLoading: isActing }] = useApplyChangeRequestActionMutation();
  const [updateRequest, { isLoading: isUpdating }] = useUpdateChangeRequestMutation();

  const [reply, setReply] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  // The list's row menu opens the modal on a given tab (?tab=history) or straight into Convert to work.
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') ?? 'request');
  const [confirmCancel, setConfirmCancel] = useState(false);
  // `null` = untouched, so a refetch never overwrites what is being typed.
  const [hoursDraft, setHoursDraft] = useState<number | null | undefined>(undefined);
  const [costDraft, setCostDraft] = useState<number | null | undefined>(undefined);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const request = query.data?.body;

  const terminal = request ? isTerminal(request.status) : false;
  const savedHours = request?.estimate?.hours ?? null;
  const savedCost = request?.estimate?.cost ?? null;
  const hours = hoursDraft === undefined ? savedHours : hoursDraft;
  const cost = costDraft === undefined ? savedCost : costDraft;
  const estimateDirty = hours !== savedHours || cost !== savedCost;
  const notes = notesDraft ?? request?.internal_assessment ?? '';
  const notesDirty = notesDraft !== null && notesDraft !== request?.internal_assessment;
  const draftEstimate: ChangeRequestEstimate = { hours, cost };

  const act = async (body: ChangeRequestAction, success: string) => {
    if (!request) return;
    try {
      await applyAction({ id: request.id, body }).unwrap();
      setReply('');
      message.success(success);
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('detail.actionFailed', { defaultValue: 'The action could not be completed.' })));
    }
  };

  const needsResponse = (run: () => void) => () => {
    if (!reply.trim()) {
      message.warning(t('detail.needsResponse', { defaultValue: 'Write a response for the client first.' }));
      return;
    }
    run();
  };

  const saveEstimate = async () => {
    if (!request) return;
    try {
      await updateRequest({
        id: request.id,
        body: { estimate: hours === null && cost === null ? null : draftEstimate },
      }).unwrap();
      setHoursDraft(undefined);
      setCostDraft(undefined);
      message.success(
        hours === null && cost === null
          ? t('detail.estimateCleared', { defaultValue: 'Estimate cleared. The client sees no time or cost.' })
          : t('detail.estimateSaved', { defaultValue: 'Estimate saved. The client sees it with your response.' })
      );
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('detail.estimateFailed', { defaultValue: 'The estimate could not be saved.' })));
    }
  };

  const saveNotes = async () => {
    if (!request) return;
    try {
      await updateRequest({ id: request.id, body: { internal_assessment: notes } }).unwrap();
      setNotesDraft(null);
      message.success(t('detail.notesSaved', { defaultValue: 'Internal assessment saved.' }));
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('detail.notesFailed', { defaultValue: 'The assessment could not be saved.' })));
    }
  };

  const changeAssignee = async (assigneeId: string | null) => {
    if (!request) return;
    try {
      await updateRequest({ id: request.id, body: { assignee_id: assigneeId } }).unwrap();
      message.success(t('detail.assigneeSaved', { defaultValue: 'Assignee updated. The client never sees internal assignment.' }));
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('detail.assigneeFailed', { defaultValue: 'The assignee could not be changed.' })));
    }
  };

  /** The status actions and Cancel sit side by side in one row; explanatory text goes above and below it. */
  const renderActions = (item: ChangeRequest) => (
    <Flex vertical gap={10}>
      {item.status === 'more_info' && (
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          {t('actions.waitingOn', {
            name: item.requester_name,
            defaultValue: 'Waiting on {{name}}. The request returns to Under Review when they reply.',
          })}
        </Typography.Text>
      )}

      <Flex gap={8} wrap="wrap" align="center">
        {item.status === 'submitted' && (
          <Button type="primary" loading={isActing} onClick={() => void act({ action: 'start_review' }, t('detail.reviewStarted', { defaultValue: 'Review started.' }))}>
            {t('actions.startReview', { defaultValue: 'Start review' })}
          </Button>
        )}

        {item.status === 'under_review' && (
          <>
            <Button
              type="primary"
              loading={isActing}
              onClick={() =>
                void act(
                  {
                    action: 'approve',
                    ...(reply.trim() ? { response: reply.trim() } : {}),
                    ...(estimateDirty ? { estimate: draftEstimate } : {}),
                  },
                  t('detail.approved', { ref: item.cr_no, defaultValue: '{{ref}} approved. The client sees the new status and your response, but not your internal notes.' })
                )
              }
            >
              {t('actions.approve', { defaultValue: 'Approve' })}
            </Button>
            <Button
              loading={isActing}
              onClick={needsResponse(
                () =>
                  void act(
                    { action: 'ask_more_info', response: reply.trim() },
                    t('detail.askedMoreInfo', { ref: item.cr_no, defaultValue: '{{ref}} is waiting on the client for more information.' })
                  )
              )}
            >
              {t('actions.askMoreInfo', { defaultValue: 'Ask client for more info' })}
            </Button>
            <Button
              danger
              loading={isActing}
              onClick={needsResponse(
                () =>
                  void act(
                    { action: 'reject', response: reply.trim() },
                    t('detail.rejected', { ref: item.cr_no, defaultValue: '{{ref}} rejected with your response.' })
                  )
              )}
            >
              {t('actions.reject', { defaultValue: 'Reject' })}
            </Button>
          </>
        )}

        {item.status === 'more_info' && (
          <Button loading={isActing} onClick={() => void act({ action: 'return_to_review' }, t('detail.returned', { defaultValue: 'Returned to Under Review.' }))}>
            {t('actions.returnToReview', { defaultValue: 'Return to review' })}
          </Button>
        )}

        {item.status === 'approved' && (
          <Button type="primary" onClick={() => setConvertOpen(true)}>
            {t('actions.convert', { defaultValue: 'Convert to work…' })}
          </Button>
        )}

        {item.status === 'in_progress' && (
          <Button
            type="primary"
            loading={isActing}
            onClick={() =>
              void act(
                { action: 'complete', response: reply.trim() || undefined },
                t('detail.completed', { ref: item.cr_no, defaultValue: '{{ref}} marked completed.' })
              )
            }
          >
            {t('actions.complete', { defaultValue: 'Mark completed' })}
          </Button>
        )}

        {!terminal && (
          <Button onClick={() => setConfirmCancel(true)}>{t('actions.cancel', { defaultValue: 'Cancel request' })}</Button>
        )}
      </Flex>

      {item.status === 'under_review' && (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {t('actions.responseHint', {
            defaultValue:
              'Asking for info and rejecting need a written response (write it in the Conversation tab). Approve sends a default one if you leave it empty.',
          })}
        </Typography.Text>
      )}

      {terminal && (
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          {t('actions.closed', { defaultValue: 'This request is closed. Its history is preserved.' })}
        </Typography.Text>
      )}
    </Flex>
  );

  const wantsConvert = searchParams.get('action') === 'convert';
  const loadedId = query.data?.body?.id;
  const loadedStatus = query.data?.body?.status;
  useEffect(() => {
    if (wantsConvert && loadedStatus === 'approved') setConvertOpen(true);
    // Only when the request first arrives; closing the dialog must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsConvert, loadedId]);

  const downloadAttachment = async (attachment: ChangeRequestAttachment) => {
    if (!attachment.file_id) return;
    try {
      const result = await getDownloadLink({ fileId: attachment.file_id }).unwrap();
      if (result.body?.url) window.open(result.body.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('detail.downloadFailed', { defaultValue: 'The download link could not be created.' })));
    }
  };

  const renderTabs = (item: ChangeRequest) => {
    const tabs = [
      {
        key: 'request',
        label: t('tabs.request', { defaultValue: 'Request & decision' }),
        children: (
          <Flex vertical gap={16}>
            <div>
              {item.status === 'cancelled' ? (
                <Alert type="warning" showIcon message={t('detail.cancelledBanner', { defaultValue: 'This request was cancelled.' })} />
              ) : (
                <ChangeRequestStepper status={item.status} />
              )}
              <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, margin: '10px 0 0' }}>
                {t('detail.noAutoTask', {
                  defaultValue: 'Submitting a change request never creates a task by itself. Approve it, then convert it to work.',
                })}
              </Typography.Paragraph>
            </div>
            <Card
              size="small"
              title={t('detail.clientRequest', { defaultValue: 'Client request' })}
              extra={<StatusTag tone="purple">{t('detail.fromClient', { defaultValue: 'From the client' })}</StatusTag>}
            >
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <RichTextView value={item.description} />
              </div>
              {item.notes && (
                <div style={{ fontSize: 12.5, marginTop: 10, color: token.colorTextSecondary }}>
                  <strong>{t('detail.notes', { defaultValue: 'Notes:' })}</strong> <RichTextView value={item.notes} />
                </div>
              )}
              {item.attachments.length > 0 && (
                <Flex vertical gap={6} style={{ marginTop: 12 }} role="list" aria-label={t('detail.attachments', { defaultValue: 'Attachments' })}>
                  {item.attachments.map(attachment => (
                    <Flex key={attachment.id} align="center" gap={8} role="listitem">
                      <PaperClipOutlined style={{ color: token.colorTextSecondary }} />
                      {attachment.file_id ? (
                        <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => void downloadAttachment(attachment)}>
                          {attachment.name}
                        </Button>
                      ) : (
                        <Tooltip title={t('detail.attachmentRemoved', { defaultValue: 'This file was removed from the project.' })}>
                          <Typography.Text type="secondary">{attachment.name}</Typography.Text>
                        </Tooltip>
                      )}
                      <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                        {formatFileSize(attachment.size)}
                      </Typography.Text>
                    </Flex>
                  ))}
                </Flex>
              )}
            </Card>
            <Card size="small" title={t('detail.decision', { defaultValue: 'Decision' })}>
              <Form layout="vertical">
                <Form.Item label={t('detail.assignee', { defaultValue: 'Assignee' })}>
                  <Select<string>
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    disabled={terminal || isUpdating}
                    loading={staffQuery.isLoading}
                    value={item.assignee?.id}
                    aria-label={t('detail.assignee', { defaultValue: 'Assignee' })}
                    onChange={value => void changeAssignee(value ?? null)}
                    placeholder={t('detail.unassigned', { defaultValue: 'Unassigned' })}
                    options={(staffQuery.data?.body ?? []).map(member => ({ value: member.id, label: member.name }))}
                  />
                </Form.Item>
              </Form>
              {renderActions(item)}
            </Card>

            <Card size="small" title={t('detail.estimate', { defaultValue: 'Estimate' })}>
              <Flex gap={12} wrap="wrap">
                <Form.Item label={t('detail.extraHours', { defaultValue: 'Extra time (hours)' })} style={{ flex: '1 1 120px', marginBottom: 8 }}>
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    value={hours}
                    disabled={terminal}
                    aria-label={t('detail.extraHours', { defaultValue: 'Extra time (hours)' })}
                    onChange={value => setHoursDraft(typeof value === 'number' ? value : null)}
                    placeholder={t('detail.notSet', { defaultValue: 'Not set' })}
                  />
                </Form.Item>
                <Form.Item label={t('detail.extraCost', { defaultValue: 'Extra cost' })} style={{ flex: '1 1 120px', marginBottom: 8 }}>
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    value={cost}
                    disabled={terminal}
                    aria-label={t('detail.extraCost', { defaultValue: 'Extra cost' })}
                    onChange={value => setCostDraft(typeof value === 'number' ? value : null)}
                    placeholder={t('detail.notSet', { defaultValue: 'Not set' })}
                  />
                </Form.Item>
              </Flex>
              <Typography.Paragraph type="secondary" style={{ fontSize: 11.5 }}>
                {t('detail.estimateHint', {
                  defaultValue: 'Leave blank if not applicable. The client never sees “0” unless you enter zero on purpose.',
                })}
              </Typography.Paragraph>
              <Button disabled={terminal || !estimateDirty} loading={isUpdating && estimateDirty} onClick={() => void saveEstimate()}>
                {t('detail.saveEstimate', { defaultValue: 'Save estimate' })}
              </Button>
            </Card>
          </Flex>
        ),
      },
      {
        key: 'conversation',
        label: t('tabs.conversation', { defaultValue: 'Conversation' }),
        children: (
          <Card
            size="small"
            title={t('detail.conversation', { defaultValue: 'Conversation with the client' })}
            extra={<StatusTag tone="green">{t('detail.clientVisible', { defaultValue: 'Client visible' })}</StatusTag>}
          >
            {item.messages.map(entry => (
              <Flex key={entry.id} gap={10} style={{ marginBottom: 14 }}>
                <PortalAvatar name={entry.author} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {entry.author}{' '}
                    <StatusTag tone={entry.from === 'client' ? 'purple' : 'blue'}>
                      {entry.from === 'client'
                        ? t('detail.fromClientTag', { defaultValue: 'Client' })
                        : t('detail.fromTeamTag', { defaultValue: 'Team' })}
                    </StatusTag>
                    <span style={{ fontWeight: 400, color: token.colorTextTertiary, marginLeft: 8 }}>
                      {formatPortalDateTime(entry.at, i18n.language)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 3, wordBreak: 'break-word' }}>
                    <RichTextView value={entry.text} />
                  </div>
                </div>
              </Flex>
            ))}
            {item.messages.length === 0 && (
              <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
                {t('detail.noMessages', { defaultValue: 'No response sent to the client yet.' })}
              </Typography.Paragraph>
            )}
            {!terminal && (
              <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 12 }}>
                <RichTextField
                  value={reply}
                  onChange={html => setReply(html)}
                  placeholder={t('detail.replyPlaceholder', { defaultValue: 'Write the response the client will see…' })}
                  ariaLabel={t('detail.replyPlaceholder', { defaultValue: 'Write the response the client will see…' })}
                  maxLength={5000}
                />
                <Button
                  size="small"
                  style={{ marginTop: 10 }}
                  disabled={!reply.trim()}
                  loading={isActing}
                  onClick={() =>
                    void act(
                      { action: 'send_response', response: reply.trim() },
                      t('detail.responseSent', { defaultValue: 'Response sent. The client is notified.' })
                    )
                  }
                >
                  {t('actions.sendResponse', { defaultValue: 'Send response only' })}
                </Button>
              </div>
            )}
          </Card>
        ),
      },
      {
        key: 'assessment',
        label: t('tabs.assessment', { defaultValue: 'Internal assessment' }),
        children: (
          <Card
            size="small"
            style={{ borderColor: token.colorWarningBorder }}
            title={t('detail.assessment', { defaultValue: 'Internal assessment' })}
            extra={
              <StatusTag tone="gray" icon={<LockOutlined />}>
                {t('detail.neverShown', { defaultValue: 'Never shown to the client' })}
              </StatusTag>
            }
          >
            <RichTextField
              value={notes}
              onChange={html => setNotesDraft(html)}
              placeholder={t('detail.assessmentPlaceholder', { defaultValue: 'Effort, risks, margin, negotiation notes…' })}
              ariaLabel={t('detail.assessment', { defaultValue: 'Internal assessment' })}
              maxLength={5000}
              tone="internal"
              minHeight={140}
            />
            <Button size="small" style={{ marginTop: 10 }} disabled={!notesDirty} loading={isUpdating && notesDirty} onClick={() => void saveNotes()}>
              {t('detail.saveNotes', { defaultValue: 'Save notes' })}
            </Button>
          </Card>
        ),
      },
      {
        key: 'work',
        label: t('tabs.work', { defaultValue: 'Linked work' }),
        children: (
          <Card size="small" title={t('detail.linkedWork', { defaultValue: 'Linked work' })}>
            {item.linked_work ? (
              <Flex justify="space-between" align="center" gap={8}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{item.linked_work.task_key}</div>
                  <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                    {item.linked_work.mode === 'linked'
                      ? t('detail.linkedTo', { ref: item.cr_no, defaultValue: 'Linked to {{ref}}' })
                      : t('detail.createdFrom', { ref: item.cr_no, defaultValue: 'Created from {{ref}}' })}
                  </div>
                </div>
                <Button size="small" onClick={() => navigate(portalPaths.project(item.project_id, 'tasks'))}>
                  {t('detail.openTask', { defaultValue: 'Open' })}
                </Button>
              </Flex>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                {item.status === 'approved'
                  ? t('detail.notConverted', { defaultValue: 'Approved but not converted yet.' })
                  : t('detail.noTaskYet', {
                      defaultValue: 'No task yet. A task is only created when you convert an approved request.',
                    })}
              </Typography.Text>
            )}

            {(item.billing.quotes.length > 0 || item.billing.invoices.length > 0) && (
              <Flex gap={6} wrap="wrap" style={{ marginTop: 10 }}>
                {item.billing.quotes.map(number => (
                  <StatusTag key={number} tone="blue">
                    {number}
                  </StatusTag>
                ))}
                {item.billing.invoices.map(number => (
                  <StatusTag key={number} tone="green">
                    {number}
                  </StatusTag>
                ))}
              </Flex>
            )}

            {isBillable(item.status) && (
              <Flex gap={8} style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                <Button size="small" onClick={() => navigate(portalPaths.newQuote(item.id))}>
                  {t('detail.createQuote', { defaultValue: 'Create quote' })}
                </Button>
                <Button size="small" onClick={() => navigate(portalPaths.newInvoice(item.id))}>
                  {t('detail.createInvoice', { defaultValue: 'Create invoice' })}
                </Button>
              </Flex>
            )}
          </Card>
        ),
      },
      {
        key: 'history',
        label: t('tabs.history', { defaultValue: 'History' }),
        children: (
          <Timeline
            items={[...item.history].reverse().map((entry, index) => ({
              key: `${entry.at}-${index}`,
              dot: entry.side === 'client' ? <UserOutlined /> : <SafetyOutlined />,
              children: (
                <div>
                  <div style={{ fontSize: 12.5 }}>
                    <strong>{entry.actor}</strong> {entry.text}
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                    {formatPortalDateTime(entry.at, i18n.language)}
                  </div>
                </div>
              ),
            }))}
          />
        ),
      },
    ];

    return <Tabs items={tabs} activeKey={activeTab} onChange={setActiveTab} />;
  };

  const isNotFound = (query.error as { status?: number } | undefined)?.status === 404;

  return (
    <>
      <Modal
        open
        onCancel={close}
        width={900}
        destroyOnHidden
        footer={null}
        title={
          request ? (
            <div>
              <Flex align="center" gap={10} wrap="wrap">
                {request.cr_no} · {decodeHtmlEntities(request.title)}
                <ChangeRequestStatusTag status={request.status} />
                <PriorityTag priority={request.priority} />
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                {t('detail.subtitle', {
                  client: decodeHtmlEntities(request.organization_name),
                  project: decodeHtmlEntities(request.project_name),
                  name: request.requester_name,
                  date: formatPortalDate(request.submitted_at, i18n.language) ?? '',
                  defaultValue: '{{client}} · {{project}} · Submitted by {{name}} on {{date}}',
                })}
              </Typography.Text>
            </div>
          ) : (
            t('detail.loadingTitle', { defaultValue: 'Change request' })
          )
        }
      >
        {query.isLoading ? (
          <div aria-busy="true">
            <PortalLoader />
          </div>
        ) : query.isError || !request ? (
          <Result
            status={isNotFound ? '404' : 'error'}
            title={
              isNotFound
                ? t('detail.notFound', { defaultValue: 'Change request not found' })
                : t('detail.loadFailed', { defaultValue: 'Could not load this change request' })
            }
            extra={
              !isNotFound && (
                <Button type="primary" onClick={() => query.refetch()}>
                  {t('retry', { defaultValue: 'Retry' })}
                </Button>
              )
            }
          />
        ) : (
          renderTabs(request)
        )}
      </Modal>

      {request && convertOpen && <ConvertToWorkModal changeRequest={request} onClose={() => setConvertOpen(false)} />}

      <ConfirmEffectModal
        open={confirmCancel}
        danger
        title={t('detail.cancelTitle', { defaultValue: 'Cancel this change request?' })}
        confirmLabel={t('detail.cancelConfirm', { defaultValue: 'Cancel request' })}
        loading={isActing}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await act({ action: 'cancel' }, t('detail.cancelled', { ref: request?.cr_no ?? '', defaultValue: '{{ref}} was cancelled.' }));
          setConfirmCancel(false);
        }}
      >
        {t('detail.cancelBody', { defaultValue: 'The client sees “Cancelled”. Nothing is deleted and the history stays.' })}
      </ConfirmEffectModal>
    </>
  );
};
