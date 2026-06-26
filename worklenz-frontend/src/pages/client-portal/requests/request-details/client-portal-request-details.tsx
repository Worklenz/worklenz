import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Flex,
  Select,
  Spin,
  Tabs,
  TabsProps,
  Tag,
  Typography,
  theme,
  Divider,
  Badge,
  Input,
  Form,
  Empty,
} from '@/shared/antd-imports';
import {
  ArrowLeftOutlined,
  DownOutlined,
  PaperClipOutlined,
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  AppstoreOutlined,
  FlagOutlined,
  FileTextOutlined as DescriptionIcon,
  QuestionCircleOutlined,
  CommentOutlined,
  SendOutlined,
  TeamOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { colors } from '../../../../styles/colors';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useGetRequestDetailsQuery,
  useUpdateOrganizationRequestStatusMutation,
  useGetRequestCommentsQuery,
  useAddRequestCommentMutation,
  useGetInvoicesByRequestQuery,
} from '../../../../api/client-portal/client-portal-api';
import { message } from 'antd';
import { durationDateFormat } from '../../../../utils/durationDateFormat';
import { getCurrencySymbol } from '../../../../shared/currencies';

const { TextArea } = Input;

interface Attachment {
  id: string;
  url: string;
  size: string;
  filename: string;
  originalName: string;
}

const ClientPortalRequestDetails = () => {
  // localization
  const { t: t1 } = useTranslation('client-portal-requests');
  const { t: t2 } = useTranslation('client-portal-common');

  // Theme tokens for dark/light mode support
  const { token } = theme.useToken();

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch request details from API
  const { data: requestData, isLoading } = useGetRequestDetailsQuery(id || '');
  const selectedRequest = requestData?.body;

  // Status update mutation
  const [updateStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOrganizationRequestStatusMutation();

  // Comments
  const { data: commentsData, refetch: refetchComments } = useGetRequestCommentsQuery(id || '', {
    skip: !id,
  });
  const [addComment, { isLoading: isAddingComment }] = useAddRequestCommentMutation();
  const [form] = Form.useForm();
  const commentValue = Form.useWatch('comment', form) || '';
  const commentsResponse = commentsData?.body;
  const comments = Array.isArray(commentsResponse)
    ? commentsResponse
    : commentsResponse?.comments || [];
  const [displayedNewCommentsCount, setDisplayedNewCommentsCount] = React.useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch invoices for this request
  const { data: invoicesData } = useGetInvoicesByRequestQuery(id || '', { skip: !id });
  const invoices = invoicesData?.body?.invoices || [];

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Update displayed count when data changes (but not when we manually clear it)
  React.useEffect(() => {
    if (
      commentsResponse &&
      !Array.isArray(commentsResponse) &&
      'newCommentsCount' in commentsResponse
    ) {
      setDisplayedNewCommentsCount(commentsResponse.newCommentsCount);
    }
  }, [commentsResponse]);

  // Handle tab change - clear unread count when Comments tab is selected
  const handleTabChange = (activeKey: string) => {
    if (activeKey === 'comments') {
      // Clear the displayed count immediately for better UX
      setDisplayedNewCommentsCount(0);
      // Refetch to update the backend timestamp
      refetchComments();
    }
  };

  // Check if request can be invoiced (not pending or rejected)
  const canCreateInvoice =
    selectedRequest?.status && !['pending', 'rejected'].includes(selectedRequest.status);

  // Navigate to invoice builder with request ID
  const handleCreateInvoice = () => {
    navigate(`/worklenz/client-portal/invoices/create?requestId=${id}`);
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    try {
      await updateStatus({ id, status: newStatus }).unwrap();
      message.success('Status updated successfully');
    } catch (error) {
      message.error('Failed to update status');
    }
  };

  // Handle add comment
  const handleAddComment = async (values: { comment: string }) => {
    if (!id) return;
    try {
      await addComment({ id, comment: values.comment }).unwrap();
      message.success(t1('commentAdded') || 'Comment added successfully');
      form.resetFields();
      refetchComments();
    } catch (error) {
      message.error(t1('commentError') || 'Failed to add comment');
    }
  };

  // Extract request_data fields
  const requestInfo = selectedRequest?.request_data || {};
  const attachments: Attachment[] = requestInfo.attachments || [];

  // Helper to format file size
  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes, 10);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper to get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'green';
      default:
        return 'default';
    }
  };

  // Helper to get status color
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'orange';
      case 'accepted':
        return 'blue';
      case 'in_progress':
        return 'processing';
      case 'completed':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const items: TabsProps['items'] = [
    {
      key: 'submission',
      label: (
        <Flex align="center" gap={6}>
          <FileTextOutlined />
          {t1('submissionTab')}
        </Flex>
      ),
      children: (
        <Flex
          vertical
          gap={24}
          style={{
            height: 'calc(100vh - 420px)',
            overflowY: 'auto',
            paddingRight: 12,
            paddingBottom: 16,
          }}
        >
          {/* Request Overview Card */}
          <Card
            size="small"
            style={{
              borderRadius: 12,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Flex vertical gap={8}>
              <Flex align="center" gap={12} style={{ marginBottom: 4 }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {requestInfo.title || t1('untitledRequest')}
                </Typography.Title>
                <Tag
                  color={getStatusColor(selectedRequest?.status || '')}
                  style={{
                    fontSize: 14,
                    padding: '4px 12px',
                    fontWeight: 500,
                    borderRadius: 6,
                  }}
                >
                  {selectedRequest?.status
                    ? selectedRequest.status.charAt(0).toUpperCase() +
                      selectedRequest.status.slice(1).replace('_', ' ')
                    : 'Unknown'}
                </Tag>
              </Flex>
              <Flex align="center" gap={16} wrap="wrap">
                <Flex align="center" gap={6}>
                  <AppstoreOutlined style={{ color: token.colorTextSecondary, fontSize: 14 }} />
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {selectedRequest?.service_name || '-'}
                  </Typography.Text>
                </Flex>
                <Flex align="center" gap={6}>
                  <UserOutlined style={{ color: token.colorTextSecondary, fontSize: 14 }} />
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 13, textTransform: 'capitalize' }}
                  >
                    {selectedRequest?.client_name || '-'}
                  </Typography.Text>
                </Flex>
                <Flex align="center" gap={6}>
                  <CalendarOutlined style={{ color: token.colorTextSecondary, fontSize: 14 }} />
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {selectedRequest?.created_at
                      ? durationDateFormat(new Date(selectedRequest.created_at))
                      : '-'}
                  </Typography.Text>
                </Flex>
                {requestInfo.priority && (
                  <Tag
                    color={getPriorityColor(requestInfo.priority)}
                    style={{
                      margin: 0,
                      textTransform: 'capitalize',
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    <FlagOutlined style={{ marginRight: 4 }} />
                    {requestInfo.priority}
                  </Tag>
                )}
              </Flex>
            </Flex>
          </Card>

          {/* Description Section */}
          {(requestInfo.description || selectedRequest?.notes) && (
            <Card
              size="small"
              title={
                <Flex align="center" gap={8}>
                  <DescriptionIcon style={{ color: token.colorPrimary }} />
                  <span>{t1('descriptionLabel')}</span>
                </Flex>
              }
              style={{
                borderRadius: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
              styles={{
                header: { borderBottom: `1px solid ${token.colorBorderSecondary}`, minHeight: 48 },
                body: { padding: '16px 24px' },
              }}
            >
              <Typography.Paragraph
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.7,
                  color: token.colorText,
                }}
              >
                {requestInfo.description || selectedRequest?.notes}
              </Typography.Paragraph>
            </Card>
          )}

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <Card
              size="small"
              title={
                <Flex align="center" gap={8}>
                  <PaperClipOutlined style={{ color: token.colorPrimary }} />
                  <span>{t1('attachmentsLabel')}</span>
                  <Badge
                    count={attachments.length}
                    style={{
                      backgroundColor: token.colorPrimary,
                      marginLeft: 4,
                    }}
                  />
                </Flex>
              }
              style={{
                borderRadius: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
              styles={{
                header: { borderBottom: `1px solid ${token.colorBorderSecondary}`, minHeight: 48 },
                body: { padding: '16px 24px' },
              }}
            >
              <Flex gap={12} wrap="wrap">
                {attachments.map(attachment => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Flex
                      align="center"
                      gap={10}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 8,
                        border: `1px solid ${token.colorBorder}`,
                        background: token.colorBgLayout,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      className="attachment-item"
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: token.colorPrimaryBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <PaperClipOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                      </div>
                      <Flex vertical gap={2}>
                        <Typography.Text ellipsis style={{ maxWidth: 200, fontWeight: 500 }}>
                          {attachment.originalName}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {formatFileSize(attachment.size)}
                        </Typography.Text>
                      </Flex>
                    </Flex>
                  </a>
                ))}
              </Flex>
            </Card>
          )}

          {/* Service Questions Section */}
          {requestInfo.questionAnswers && requestInfo.questionAnswers.length > 0 && (
            <Card
              size="small"
              title={
                <Flex align="center" gap={8}>
                  <QuestionCircleOutlined style={{ color: token.colorPrimary }} />
                  <span>{t1('serviceQuestionsLabel')}</span>
                  <Badge
                    count={requestInfo.questionAnswers.length}
                    style={{
                      backgroundColor: token.colorPrimary,
                      marginLeft: 4,
                    }}
                  />
                </Flex>
              }
              style={{
                borderRadius: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
              styles={{
                header: { borderBottom: `1px solid ${token.colorBorderSecondary}`, minHeight: 48 },
                body: { padding: '16px 24px' },
              }}
            >
              <Flex vertical gap={16}>
                {requestInfo.questionAnswers.map(
                  (
                    qa: {
                      question: string;
                      type: string;
                      answer: string | string[] | null;
                      attachments?: Array<{
                        id?: string;
                        url: string;
                        filename: string;
                        originalName: string;
                        size: number;
                      }>;
                    },
                    index: number
                  ) => (
                    <div key={index}>
                      {index > 0 && <Divider style={{ margin: '0 0 16px 0' }} />}
                      <Flex vertical gap={8}>
                        <Typography.Text style={{ fontWeight: 600, color: token.colorText }}>
                          {qa.question}
                        </Typography.Text>
                        {qa.type === 'attachment' ? (
                          qa.attachments && qa.attachments.length > 0 ? (
                            <Flex gap={8} wrap="wrap">
                              {qa.attachments.map((att, attIndex) => (
                                <a
                                  key={attIndex}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ textDecoration: 'none' }}
                                >
                                  <Tag
                                    icon={<PaperClipOutlined />}
                                    style={{
                                      cursor: 'pointer',
                                      padding: '4px 10px',
                                      borderRadius: 6,
                                    }}
                                  >
                                    {att.originalName}
                                  </Tag>
                                </a>
                              ))}
                            </Flex>
                          ) : (
                            <Typography.Text type="secondary" style={{ fontStyle: 'italic' }}>
                              {t1('noFilesUploaded')}
                            </Typography.Text>
                          )
                        ) : (
                          <Typography.Text
                            style={{
                              whiteSpace: 'pre-wrap',
                              color: qa.answer ? token.colorText : token.colorTextSecondary,
                              fontStyle: qa.answer ? 'normal' : 'italic',
                              lineHeight: 1.6,
                            }}
                          >
                            {qa.answer || t1('noAnswer')}
                          </Typography.Text>
                        )}
                      </Flex>
                    </div>
                  )
                )}
              </Flex>
            </Card>
          )}
        </Flex>
      ),
    },
    {
      key: 'comments',
      label: (
        <Flex align="center" gap={6}>
          <CommentOutlined />
          {t1('commentsTab') || 'Comments'}
          {displayedNewCommentsCount > 0 && (
            <Badge
              count={displayedNewCommentsCount}
              style={{ backgroundColor: token.colorError, marginLeft: 4 }}
            />
          )}
        </Flex>
      ),
      children: (
        <Flex
          vertical
          style={{
            height: 'calc(100vh - 420px)',
            overflow: 'hidden',
          }}
        >
          {/* Chat Messages Area */}
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
              <Empty
                description={t1('noComments') || 'No comments yet. Start the conversation!'}
                style={{ marginTop: 60 }}
              />
            ) : (
              <>
                {comments.map(comment => {
                  const isTeamMember = comment.sender_type === 'team_member';
                  const isOwnMessage = isTeamMember; // Admin's own messages (team member)
                  return (
                    <Flex
                      key={comment.id}
                      justify={isOwnMessage ? 'flex-end' : 'flex-start'}
                      style={{ marginBottom: 16 }}
                    >
                      <Flex
                        gap={8}
                        align="flex-start"
                        style={{
                          maxWidth: '75%',
                          flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                        }}
                      >
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
                            <TeamOutlined style={{ color: '#fff', fontSize: 14 }} />
                          ) : (
                            <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <Flex
                            align="center"
                            gap={8}
                            style={{
                              marginBottom: 4,
                              flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                            }}
                          >
                            <Typography.Text strong style={{ fontSize: 13 }}>
                              {comment.sender_name}
                            </Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                              {new Date(comment.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography.Text>
                          </Flex>
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: isOwnMessage
                                ? '16px 16px 4px 16px'
                                : '16px 16px 16px 4px',
                              backgroundColor: isOwnMessage
                                ? token.colorPrimary
                                : token.colorBgContainer,
                              color: isOwnMessage ? '#fff' : token.colorText,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                              wordBreak: 'break-word',
                            }}
                          >
                            <Typography.Text
                              style={{
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.5,
                                color: 'inherit',
                              }}
                            >
                              {comment.comment}
                            </Typography.Text>
                          </div>
                          <Typography.Text
                            type="secondary"
                            style={{
                              fontSize: 10,
                              marginTop: 4,
                              display: 'block',
                              textAlign: isOwnMessage ? 'right' : 'left',
                            }}
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

          {/* Compact Input Area */}
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
                  rules={[
                    { required: true, message: t1('commentRequired') || 'Please enter a comment' },
                  ]}
                  style={{ marginBottom: 0, flex: 1 }}
                >
                  <TextArea
                    rows={2}
                    placeholder={t1('addCommentPlaceholder') || 'Type your comment here...'}
                    maxLength={5000}
                    style={{
                      borderRadius: 20,
                      resize: 'none',
                    }}
                    onPressEnter={e => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        form.submit();
                      }
                    }}
                  />
                </Form.Item>
                <Button
                  type="primary"
                  shape="circle"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={isAddingComment}
                  size="large"
                  style={{ marginBottom: 4 }}
                />
              </Flex>
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11, marginTop: 4, display: 'block' }}
              >
                {commentValue.length}/5000 ·{' '}
                {t1('pressEnterToSend') || 'Press Enter to send, Shift+Enter for new line'}
              </Typography.Text>
            </Form>
          </div>
        </Flex>
      ),
    },
    {
      key: 'invoices',
      label: (
        <Flex align="center" gap={6}>
          <DollarOutlined />
          {t1('invoicesTab') || 'Invoices'}
          {invoices.length > 0 && (
            <Badge
              count={invoices.length}
              style={{ backgroundColor: token.colorPrimary, marginLeft: 4 }}
            />
          )}
        </Flex>
      ),
      children: (
        <Flex
          vertical
          gap={16}
          style={{
            height: 'calc(100vh - 420px)',
            overflowY: 'auto',
            paddingRight: 12,
            paddingBottom: 16,
          }}
        >
          {invoices.length === 0 ? (
            <Empty
              description={t1('noInvoices') || 'No invoices for this request yet'}
              style={{ marginTop: 60 }}
            />
          ) : (
            <>
              <Typography.Text type="secondary" style={{ fontSize: 13, marginBottom: 8 }}>
                {t1('invoicesDescription') ||
                  `${invoices.length} invoice${invoices.length === 1 ? '' : 's'} linked to this request`}
              </Typography.Text>
              {invoices.map((invoice: any) => {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'paid':
                      return 'success';
                    case 'sent':
                      return 'processing';
                    case 'draft':
                      return 'default';
                    case 'overdue':
                      return 'error';
                    case 'cancelled':
                      return 'default';
                    default:
                      return 'default';
                  }
                };

                return (
                  <Card
                    key={invoice.id}
                    size="small"
                    hoverable
                    onClick={() => navigate(`/worklenz/client-portal/invoices/${invoice.id}`)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 8,
                      border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  >
                    <Flex justify="space-between" align="center">
                      <Flex vertical gap={4}>
                        <Flex align="center" gap={8}>
                          <Typography.Text strong>{invoice.invoiceNo}</Typography.Text>
                          <Tag
                            color={getStatusColor(invoice.status)}
                            style={{ textTransform: 'capitalize', fontSize: 11 }}
                          >
                            {invoice.status}
                          </Tag>
                        </Flex>
                        <Flex align="center" gap={12}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {getCurrencySymbol(invoice.currency)}
                            {invoice.amount.toFixed(2)}
                          </Typography.Text>
                          {invoice.dueDate && (
                            <>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                •
                              </Typography.Text>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                Due: {durationDateFormat(new Date(invoice.dueDate))}
                              </Typography.Text>
                            </>
                          )}
                        </Flex>
                      </Flex>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {durationDateFormat(new Date(invoice.createdAt))}
                      </Typography.Text>
                    </Flex>
                  </Card>
                );
              })}
            </>
          )}
        </Flex>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ height: 'calc(100vh - 200px)' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Flex gap={12} align="center">
          <Button
            icon={<ArrowLeftOutlined style={{ fontSize: 22 }} />}
            className="borderless-icon-btn"
            style={{ boxShadow: 'none' }}
            onClick={() => navigate('/worklenz/client-portal/requests')}
          />

          <Typography.Title level={5} style={{ marginBlock: 0 }}>
            {t1('reqNoText')}: {selectedRequest?.req_no}
          </Typography.Title>
        </Flex>

        <Flex gap={12} align="center">
          <Typography.Text strong style={{ fontSize: 14, color: token.colorTextSecondary }}>
            {t2('status')}:
          </Typography.Text>
          <Select
            value={selectedRequest?.status}
            options={[
              { label: t2('pending'), value: 'pending' },
              { label: t2('accepted'), value: 'accepted' },
              { label: t2('inProgress'), value: 'in_progress' },
              { label: t2('completed'), value: 'completed' },
              { label: t2('rejected'), value: 'rejected' },
            ]}
            onChange={handleStatusChange}
            loading={isUpdatingStatus}
            disabled={isUpdatingStatus}
            style={{
              minWidth: 140,
              border: `1px solid ${colors.skyBlue}`,
              borderRadius: '6px',
              backgroundColor: token.colorBgContainer,
            }}
            placeholder="Select status"
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            dropdownStyle={{
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          />
          {canCreateInvoice && (
            <Button type="primary" icon={<FileTextOutlined />} onClick={handleCreateInvoice}>
              {t1('createInvoiceButton') || 'Create Invoice'}
            </Button>
          )}
        </Flex>
      </Flex>
      <Card
        style={{
          height: 'calc(100vh - 280px)',
          borderRadius: 12,
        }}
        styles={{ body: { padding: '16px 24px', height: '100%' } }}
      >
        <Tabs
          defaultActiveKey="submission"
          items={items}
          onChange={handleTabChange}
          style={{
            height: '100%',
          }}
          tabBarStyle={{
            marginBottom: 16,
          }}
        />
      </Card>
    </Flex>
  );
};

export default ClientPortalRequestDetails;
