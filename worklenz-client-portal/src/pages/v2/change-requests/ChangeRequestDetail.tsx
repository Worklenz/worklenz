import React, { useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Flex,
  Modal,
  Row,
  Tag,
  Typography,
  PaperClipOutlined,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import {
  useCancelChangeRequestMutation,
  useGetChangeRequestQuery,
  useReplyChangeRequestMutation,
} from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import { useFileAccess } from '@/hooks/useFileActions';
import { DetailModal, LockedNote, QueryState, RichTextField, RichTextView, StatusTag, errorMessage, isRichTextEmpty } from '@/components/v2';
import { formatEstimate } from '@/utils/estimate';
import { decodeHtmlEntities } from '@/utils/html-entities';
import type { ChangeRequestStatus, ClientChangeRequestDetailV2 } from '@/types/v2';

const STEPS = ['Submitted', 'Under review', 'Decision', 'In progress', 'Completed'] as const;

const stepIndex = (status: ChangeRequestStatus): number =>
  ({ submitted: 0, under_review: 1, more_info: 1, approved: 2, rejected: 2, in_progress: 3, completed: 4, cancelled: -1 })[status];

/** Five-step progress. Rejected shows in red on the Decision step; cancelled has its own banner. */
export const ChangeRequestStepper = ({ status }: { status: ChangeRequestStatus }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const index = stepIndex(status);

  return (
    <ol aria-label={t('changeRequests.progress', { defaultValue: 'Progress' })} style={{ display: 'flex', gap: 4, listStyle: 'none', margin: 0, padding: 0 }}>
      {STEPS.map((label, position) => {
        const done = index >= 0 && position < index;
        const current = position === index;
        const rejected = current && status === 'rejected';
        const shown =
          position === 2
            ? status === 'rejected'
              ? t('status.changeRequest.rejected', { defaultValue: 'Rejected' })
              : index > 2 || status === 'approved'
                ? t('status.changeRequest.approved', { defaultValue: 'Approved' })
                : t('changeRequests.step.decision', { defaultValue: 'Decision' })
            : t(`changeRequests.step.${label}`, { defaultValue: label });
        return (
          <li key={label} aria-current={current ? 'step' : undefined} style={{ flex: 1 }}>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: rejected ? token.colorError : done || current ? token.colorPrimary : token.colorBorder,
                opacity: done ? 0.55 : 1,
              }}
            />
            <div
              style={{
                fontSize: 11,
                marginTop: 5,
                fontWeight: current ? 700 : 500,
                opacity: current ? 1 : done ? 0.7 : 0.45,
                color: rejected ? token.colorError : undefined,
              }}
            >
              {shown}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

/** One change request in a dialog over the list (spec #2525). */
export const ChangeRequestDetail: React.FC<{ id: string | undefined; onClose: () => void }> = ({ id, onClose }) => {
  const { t } = useTranslation();
  const query = useGetChangeRequestQuery(id ?? '', { skip: !id });

  return (
    <DetailModal open={Boolean(id)} onClose={onClose} title={t('changeRequests.title', { defaultValue: 'Change Requests' })}>
      <QueryState
        {...query}
        refetch={query.refetch}
        onBack={onClose}
        backLabel={t('changeRequests.backToList', { defaultValue: 'Back to change requests' })}
      >
        {query.data && <ChangeRequestBody request={query.data} />}
      </QueryState>
    </DetailModal>
  );
};

const ChangeRequestBody: React.FC<{ request: ClientChangeRequestDetailV2 }> = ({ request }) => {
  const { t } = useTranslation();
  const message = useMessage();
  const { token } = theme.useToken();
  const { can } = useClientAccess();
  const { date, dateTime } = useFormatters();
  const { openFile } = useFileAccess();
  const [reply] = useReplyChangeRequestMutation();
  const [cancel] = useCancelChangeRequestMutation();
  const [info, setInfo] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const estimate = formatEstimate(request.estimate);
  const timeline = [...request.timeline].sort((a, b) => b.at.localeCompare(a.at));

  const sendInfo = async () => {
    const text = info;
    if (isRichTextEmpty(text) || sending) return;
    setSending(true);
    try {
      await reply({ id: request.id, text }).unwrap();
      setInfo('');
      void message.success(t('changeRequests.infoSent', { defaultValue: 'Thanks. Your team has the information and the request is back under review.' }));
    } catch (error) {
      void message.error(errorMessage(error) ?? t('changeRequests.replyFailed', { defaultValue: 'We could not send your reply. Please try again.' }));
    } finally {
      setSending(false);
    }
  };

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancel(request.id).unwrap();
      void message.success(t('changeRequests.cancelled', { crNo: request.cr_no, defaultValue: '{{crNo}} cancelled.' }));
      setConfirmCancel(false);
    } catch (error) {
      void message.error(errorMessage(error) ?? t('changeRequests.cancelFailed', { defaultValue: 'We could not cancel this request.' }));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      <Flex justify="space-between" align="flex-start" gap={12} wrap="wrap" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {decodeHtmlEntities(request.title)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {request.cr_no} · {decodeHtmlEntities(request.project_name)} ·{' '}
            {t('changeRequests.submittedBy', { date: date(request.submitted_at), name: request.requester_name, defaultValue: 'Submitted {{date}} by {{name}}' })}
          </Typography.Text>
        </div>
        <Flex gap={8}>
          <StatusTag kind="priority" status={request.priority} />
          <StatusTag kind="changeRequest" status={request.status} />
        </Flex>
      </Flex>

      <Card style={{ marginBottom: 16 }}>
        {request.status === 'cancelled' ? (
          <Alert type="warning" showIcon message={t('changeRequests.wasCancelled', { defaultValue: 'This request was cancelled.' })} />
        ) : (
          <ChangeRequestStepper status={request.status} />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title={t('changeRequests.yourRequest', { defaultValue: 'Your request' })} style={{ marginBottom: 16 }}>
            <div style={{ lineHeight: 1.6, marginBottom: 12 }}>
              <RichTextView value={request.description} />
            </div>
            {request.notes && (
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary" strong style={{ display: 'block', marginBottom: 2 }}>
                  {t('changeRequests.notesLabel', { defaultValue: 'Notes' })}
                </Typography.Text>
                <RichTextView value={request.notes} />
              </div>
            )}
            {request.attachment_files.length > 0 && (
              <Flex gap={8} wrap="wrap">
                {request.attachment_files.map(file => (
                  <Tag
                    key={file.id}
                    icon={<PaperClipOutlined />}
                    style={{ cursor: 'pointer', padding: '4px 10px' }}
                    role="button"
                    tabIndex={0}
                    onClick={() => void openFile(file, 'download')}
                    onKeyDown={event => event.key === 'Enter' && void openFile(file, 'download')}
                  >
                    {file.name}
                  </Tag>
                ))}
              </Flex>
            )}
          </Card>

          <Card title={t('changeRequests.conversation', { defaultValue: 'Conversation with your team' })} style={{ marginBottom: 16 }}>
            {request.thread.map((entry, index) => (
              <Flex key={`${entry.at}-${index}`} gap={10} style={{ marginBottom: 14 }}>
                <Avatar size={30} style={{ backgroundColor: entry.from === 'client' ? token.colorPrimary : token.colorSuccess }}>
                  {entry.author[0]}
                </Avatar>
                <div>
                  <Typography.Text strong style={{ fontSize: token.fontSizeSM }}>
                    {entry.author}
                    {entry.from === 'team' && (
                      <Tag color="blue" style={{ marginInlineStart: 6 }}>
                        {t('discussions.team', { defaultValue: 'Team' })}
                      </Tag>
                    )}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, marginInlineStart: 8 }}>
                    {dateTime(entry.at)}
                  </Typography.Text>
                  <div style={{ marginTop: 3 }}>
                    <RichTextView value={entry.text} />
                  </div>
                </div>
              </Flex>
            ))}
            {request.thread.length === 0 && (
              <Typography.Text type="secondary">
                {t('changeRequests.noReply', { defaultValue: 'Your team has not responded yet. You are notified as soon as they do.' })}
              </Typography.Text>
            )}
            {request.status === 'more_info' &&
              (can.submitChangeRequest ? (
                <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 12, marginTop: 8 }}>
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 10 }}
                    message={t('changeRequests.needMoreInfo', { defaultValue: 'Your team needs more information before they can decide.' })}
                  />
                  <RichTextField
                    value={info}
                    onChange={setInfo}
                    maxLength={5000}
                    minHeight={72}
                    onSubmit={() => void sendInfo()}
                    ariaLabel={t('changeRequests.infoLabel', { defaultValue: 'Information for your team' })}
                    placeholder={t('changeRequests.infoPlaceholder', { defaultValue: 'Add the information they asked for…' })}
                  />
                  <Button type="primary" size="small" style={{ marginTop: 10 }} loading={sending} disabled={isRichTextEmpty(info)} onClick={() => void sendInfo()}>
                    {t('changeRequests.sendInfo', { defaultValue: 'Send information' })}
                  </Button>
                </div>
              ) : (
                <LockedNote>{t('locked.changeRequestReply', { defaultValue: "Client Viewers can't reply to change requests." })}</LockedNote>
              ))}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={t('changeRequests.estimate', { defaultValue: 'Estimate' })} style={{ marginBottom: 16 }}>
            {estimate ? (
              <>
                <Typography.Title level={4} style={{ margin: 0 }}>{estimate}</Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t('changeRequests.estimateHelp', { defaultValue: 'Estimated additional time and cost.' })}
                </Typography.Text>
              </>
            ) : (
              <Typography.Text type="secondary">
                {t('changeRequests.noEstimate', { defaultValue: 'No estimate yet. Your team adds one if it applies.' })}
              </Typography.Text>
            )}
          </Card>
          <Card title={t('changeRequests.progress', { defaultValue: 'Progress' })} style={{ marginBottom: 16 }}>
            {timeline.map((entry, index) => (
              <Flex key={`${entry.at}-${index}`} justify="space-between" gap={8} style={{ padding: '7px 0', borderBottom: `1px solid ${token.colorBorderSecondary}`, fontSize: token.fontSizeSM }}>
                <span>{entry.text}</span>
                <Typography.Text type="secondary">{dateTime(entry.at)}</Typography.Text>
              </Flex>
            ))}
          </Card>
          {request.can_cancel && (
            <Button block size="small" onClick={() => setConfirmCancel(true)}>
              {t('changeRequests.cancelAction', { defaultValue: 'Cancel this request' })}
            </Button>
          )}
        </Col>
      </Row>

      <Modal
        open={confirmCancel}
        onCancel={() => setConfirmCancel(false)}
        width={420}
        title={t('changeRequests.cancelTitle', { defaultValue: 'Cancel this request?' })}
        footer={[
          <Button key="keep" onClick={() => setConfirmCancel(false)}>
            {t('changeRequests.keepIt', { defaultValue: 'Keep it' })}
          </Button>,
          <Button key="cancel" type="primary" danger loading={cancelling} onClick={() => void doCancel()}>
            {t('changeRequests.cancelConfirm', { defaultValue: 'Cancel request' })}
          </Button>,
        ]}
      >
        {t('changeRequests.cancelBody', {
          crNo: request.cr_no,
          defaultValue: 'Your team stops working on {{crNo}}. You can submit a new request later.',
        })}
      </Modal>
    </div>
  );
};
