import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Spin,
  Tabs,
  TabsProps,
  Tag,
  Typography,
  theme,
  message,
  PaperClipOutlined,
  TeamOutlined,
  UserOutlined,
  DeleteOutlined,
} from '@/shared/antd-imports';
import { SendOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  useGetTicketByIdQuery,
  useUpdateTicketStatusMutation,
  useGetTicketCommentsQuery,
  useAddTicketCommentMutation,
  useGetTicketCustomStatusesQuery,
  useGetTicketAttachmentsQuery,
  useUploadTicketAttachmentMutation,
  useDeleteTicketAttachmentMutation,
} from '../../../../api/client-portal/client-portal-api';
import { durationDateFormat } from '../../../../utils/durationDateFormat';
import { TICKET_BUILT_IN_STATUSES, TICKET_BUILT_IN_STATUS_I18N, ticketPriorityColor } from '../tickets-list-helpers';
import ConvertToTaskModal from '../ConvertToTaskModal';

const { TextArea } = Input;

const formatFileSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const TicketDetailModal = () => {
  const { t: t1 } = useTranslation('client-portal-tickets');
  const { t: t2 } = useTranslation('client-portal-common');
  const { token } = theme.useToken();

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: ticketData, isLoading, isError, error, refetch } = useGetTicketByIdQuery(id || '', {
    skip: !id,
  });
  const ticket = ticketData?.body;

  const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateTicketStatusMutation();
  const { data: customStatusesData } = useGetTicketCustomStatusesQuery();
  const customStatuses = customStatusesData?.body ?? [];

  const { data: commentsData } = useGetTicketCommentsQuery(id || '', { skip: !id });
  const comments = commentsData?.body ?? [];
  const [addComment, { isLoading: isAddingComment }] = useAddTicketCommentMutation();
  const [form] = Form.useForm();
  const commentValue = Form.useWatch('comment', form) || '';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: attachmentsData } = useGetTicketAttachmentsQuery(id || '', { skip: !id });
  const attachments = attachmentsData?.body ?? [];
  const [uploadAttachment, { isLoading: isUploading }] = useUploadTicketAttachmentMutation();
  const [deleteAttachment] = useDeleteTicketAttachmentMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [convertOpen, setConvertOpen] = useState(false);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/worklenz/client-portal/ticketing');
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    try {
      await updateStatus({ id, status: newStatus }).unwrap();
      message.success(t1('statusUpdateSuccess', { defaultValue: 'Status updated successfully' }));
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(errorData?.message || t1('statusUpdateError', { defaultValue: 'Failed to update status' }));
    }
  };

  const handleMarkResolved = () => handleStatusChange('resolved');

  const handleAddComment = async (values: { comment: string }) => {
    if (!id) return;
    try {
      await addComment({ id, comment: values.comment }).unwrap();
      form.resetFields();
    } catch (err) {
      message.error(t1('commentError', { defaultValue: 'Failed to add comment' }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !id) return;

    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      try {
        await uploadAttachment({ id, fileData: base64, fileName: file.name, fileType: file.type }).unwrap();
        message.success(t1('attachmentUploadSuccess', { defaultValue: 'File uploaded successfully' }));
      } catch (err) {
        const errorData = (err as { data?: { message?: string } })?.data;
        message.error(errorData?.message || t1('attachmentUploadError', { defaultValue: 'Failed to upload file' }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!id) return;
    try {
      await deleteAttachment({ id, attachmentId }).unwrap();
      message.success(t1('attachmentRemoveSuccess', { defaultValue: 'Attachment removed' }));
    } catch (err) {
      message.error(t1('attachmentRemoveError', { defaultValue: 'Failed to remove attachment' }));
    }
  };

  const statusOptions = [
    ...TICKET_BUILT_IN_STATUSES.map(status => ({
      value: status,
      label: t2(TICKET_BUILT_IN_STATUS_I18N[status].key, { defaultValue: TICKET_BUILT_IN_STATUS_I18N[status].defaultValue }),
    })),
    ...customStatuses.map(status => ({ value: status.name, label: status.name })),
  ];

  const items: TabsProps['items'] = [
    {
      key: 'details',
      label: t1('detailsTab', { defaultValue: 'Details' }),
      children: (
        <Flex vertical gap={16} style={{ paddingBottom: 8 }}>
          <Card
            size="small"
            style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Flex vertical gap={8}>
              <Flex align="center" gap={12} wrap="wrap">
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {ticket?.subject}
                </Typography.Title>
                <Tag color={ticketPriorityColor(ticket?.priority || '')} style={{ margin: 0, textTransform: 'capitalize' }}>
                  {ticket?.priority}
                </Tag>
              </Flex>
              <Flex align="center" gap={8} wrap="wrap">
                <Typography.Text type="secondary" style={{ fontSize: 13, textTransform: 'capitalize' }}>
                  {ticket?.client_name || '-'}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  ·
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {ticket?.created_at ? durationDateFormat(new Date(ticket.created_at)) : '-'}
                </Typography.Text>
                {ticket?.converted_task_id && (
                  <>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      ·
                    </Typography.Text>
                    <Tag color="purple" style={{ margin: 0 }}>
                      {t1('convertedToTaskLabel', { defaultValue: 'Converted to task' })}
                    </Tag>
                  </>
                )}
              </Flex>
            </Flex>
          </Card>

          {ticket?.description && (
            <Card
              size="small"
              title={t1('descriptionLabel', { defaultValue: 'Description' })}
              style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }}
              styles={{ header: { borderBottom: 'none', minHeight: 48, paddingTop: 4 }, body: { padding: '0 20px 16px' } }}
            >
              <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: token.colorText }}>
                {ticket.description}
              </Typography.Paragraph>
            </Card>
          )}

          <Card
            size="small"
            title={
              <Flex align="center" gap={8}>
                <span>{t1('attachmentsLabel', { defaultValue: 'Attachments' })}</span>
                {attachments.length > 0 && (
                  <Badge count={attachments.length} style={{ backgroundColor: token.colorPrimary, marginLeft: 4 }} />
                )}
              </Flex>
            }
            extra={
              <Button size="small" icon={<PaperClipOutlined />} loading={isUploading} onClick={() => fileInputRef.current?.click()}>
                {t1('uploadAttachmentButton', { defaultValue: 'Attach File' })}
              </Button>
            }
            style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }}
            styles={{ header: { borderBottom: 'none', minHeight: 48, paddingTop: 4 }, body: { padding: '0 20px 16px' } }}
          >
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
            {attachments.length === 0 ? (
              <Typography.Text type="secondary" style={{ fontStyle: 'italic' }}>
                {t1('noAttachments', { defaultValue: 'No attachments yet.' })}
              </Typography.Text>
            ) : (
              <Flex gap={12} wrap="wrap">
                {attachments.map((attachment: any) => (
                  <Flex
                    key={attachment.id}
                    align="center"
                    gap={10}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${token.colorBorder}`,
                      background: token.colorBgLayout,
                    }}
                  >
                    <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <Flex align="center" gap={8}>
                        <PaperClipOutlined style={{ color: token.colorPrimary }} />
                        <Flex vertical gap={2}>
                          <Typography.Text ellipsis style={{ maxWidth: 180, fontWeight: 500 }}>
                            {attachment.file_name}
                          </Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            {formatFileSize(attachment.file_size)}
                          </Typography.Text>
                        </Flex>
                      </Flex>
                    </a>
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      aria-label={t1('removeAttachmentLabel', {
                        name: attachment.file_name,
                        defaultValue: 'Remove {{name}}',
                      })}
                    />
                  </Flex>
                ))}
              </Flex>
            )}
          </Card>
        </Flex>
      ),
    },
    {
      key: 'comments',
      label: (
        <Flex align="center" gap={6}>
          {t1('commentsTab', { defaultValue: 'Comments' })}
          {comments.length > 0 && (
            <Badge count={comments.length} style={{ backgroundColor: token.colorPrimary, marginLeft: 4 }} />
          )}
        </Flex>
      ),
      children: (
        <Flex vertical style={{ height: '55vh', overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              backgroundColor: token.colorBgLayout,
              borderRadius: '8px 8px 0 0',
            }}
          >
            {comments.length === 0 ? (
              <Empty description={t1('noComments', { defaultValue: 'No comments yet.' })} style={{ marginTop: 60 }} />
            ) : (
              <>
                {comments.map((comment: any) => {
                  const isTeamMember = comment.sender_type === 'team_member';
                  return (
                    <Flex key={comment.id} justify={isTeamMember ? 'flex-end' : 'flex-start'} style={{ marginBottom: 16 }}>
                      <Flex gap={8} align="flex-start" style={{ maxWidth: '75%', flexDirection: isTeamMember ? 'row-reverse' : 'row' }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: isTeamMember ? token.colorPrimary : token.colorSuccess,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isTeamMember ? (
                            <TeamOutlined style={{ color: '#fff', fontSize: 12 }} />
                          ) : (
                            <UserOutlined style={{ color: '#fff', fontSize: 12 }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <Flex align="center" gap={8} style={{ marginBottom: 4, flexDirection: isTeamMember ? 'row-reverse' : 'row' }}>
                            <Typography.Text strong style={{ fontSize: 13 }}>
                              {comment.sender_name}
                            </Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                              {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography.Text>
                          </Flex>
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: isTeamMember ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              backgroundColor: isTeamMember ? token.colorPrimary : token.colorBgContainer,
                              color: isTeamMember ? '#fff' : token.colorText,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                              wordBreak: 'break-word',
                            }}
                          >
                            <Typography.Text style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'inherit' }}>
                              {comment.comment}
                            </Typography.Text>
                          </div>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 10, marginTop: 4, display: 'block', textAlign: isTeamMember ? 'right' : 'left' }}
                          >
                            {durationDateFormat(new Date(comment.created_at))}
                          </Typography.Text>
                        </div>
                      </Flex>
                    </Flex>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              backgroundColor: token.colorBgContainer,
              borderRadius: '0 0 8px 8px',
            }}
          >
            <Form form={form} onFinish={handleAddComment}>
              <Flex gap={12} align="flex-end">
                <Form.Item
                  name="comment"
                  rules={[{ required: true, message: t1('commentRequired', { defaultValue: 'Please enter a comment' }) }]}
                  style={{ marginBottom: 0, flex: 1 }}
                >
                  <TextArea
                    rows={2}
                    placeholder={t1('addCommentPlaceholder', { defaultValue: 'Type your comment here...' })}
                    maxLength={5000}
                    style={{ borderRadius: 20, resize: 'none' }}
                    onPressEnter={e => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        form.submit();
                      }
                    }}
                  />
                </Form.Item>
                <Button type="primary" shape="circle" htmlType="submit" icon={<SendOutlined />} loading={isAddingComment} size="large" style={{ marginBottom: 4 }} />
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                {commentValue.length}/5000 · {t1('pressEnterToSend', { defaultValue: 'Press Enter to send, Shift+Enter for new line' })}
              </Typography.Text>
            </Form>
          </div>
        </Flex>
      ),
    },
  ];

  let body: React.ReactNode;

  if (isLoading) {
    body = (
      <Flex justify="center" align="center" style={{ height: 400 }}>
        <Spin size="large" />
      </Flex>
    );
  } else if (isError || !ticket) {
    const isNotFound = (error as { status?: number } | undefined)?.status === 404;
    body = (
      <Result
        status={isNotFound ? '404' : 'error'}
        title={
          isNotFound
            ? t1('ticketNotFoundTitle', { defaultValue: 'Ticket not found' })
            : t1('ticketLoadErrorTitle', { defaultValue: "Couldn't load this ticket" })
        }
        subTitle={
          isNotFound
            ? t1('ticketNotFoundDescription', {
                defaultValue: 'This ticket may have been deleted or you may not have access to it.',
              })
            : t1('ticketLoadErrorDescription', {
                defaultValue: 'There was an error loading this ticket. Please try again.',
              })
        }
        extra={[
          !isNotFound && (
            <Button key="retry" type="primary" onClick={() => refetch()}>
              {t1('retryButton', { defaultValue: 'Retry' })}
            </Button>
          ),
          <Button key="back" type={isNotFound ? 'primary' : 'default'} onClick={goBack}>
            {t1('backToTickets', { defaultValue: 'Back to Ticketing' })}
          </Button>,
        ]}
      />
    );
  } else {
    body = (
      <Flex vertical gap={16} style={{ width: '100%' }}>
        <Flex gap={8} align="center">
          <Typography.Text style={{ fontSize: 13, color: token.colorTextSecondary }}>
            {t1('statusColumn', { defaultValue: 'Status' })}:
          </Typography.Text>
          <Select
            value={ticket.status}
            options={statusOptions}
            onChange={handleStatusChange}
            loading={isUpdatingStatus}
            disabled={isUpdatingStatus}
            style={{ minWidth: 160 }}
          />
        </Flex>
        <Tabs defaultActiveKey="details" items={items} />
      </Flex>
    );
  }

  return (
    <>
      <Modal
        open
        onCancel={goBack}
        title={
          ticket ? (
            <Typography.Text strong style={{ fontSize: 16 }}>
              {ticket.ticket_no}
            </Typography.Text>
          ) : null
        }
        footer={
          ticket ? (
            <Flex justify="flex-end" gap={8}>
              <Button size="small" onClick={goBack}>
                {t1('closeButton', { defaultValue: 'Close' })}
              </Button>
              <Button size="small" onClick={() => setConvertOpen(true)} disabled={Boolean(ticket.converted_task_id)}>
                {t1('convertToTaskButton', { defaultValue: 'Convert to Task' })}
              </Button>
              {ticket.status !== 'resolved' && (
                <Button type="primary" size="small" onClick={handleMarkResolved} loading={isUpdatingStatus}>
                  {t1('markAsResolvedButton', { defaultValue: 'Mark as Resolved' })}
                </Button>
              )}
            </Flex>
          ) : null
        }
        width="min(720px, 96vw)"
        style={{ top: 24 }}
        styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
      >
        {body}
      </Modal>

      <ConvertToTaskModal ticket={convertOpen ? ticket : null} onClose={() => setConvertOpen(false)} />
    </>
  );
};

export default TicketDetailModal;
