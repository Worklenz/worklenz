import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Typography,
  Descriptions,
  Tag,
  Button,
  Timeline,
  Input,
  Form,
  message,
  Spin,
  Alert,
  Row,
  Col,
  Avatar,
  Flex,
  theme,
} from "@/shared/antd-imports";
import {
  ArrowLeftOutlined,
  SendOutlined,
  PaperClipOutlined,
  UserOutlined,
  TeamOutlined,
  CommentOutlined,
} from "@/shared/antd-imports";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useGetRequestDetailsQuery,
  useGetRequestStatusHistoryQuery,
  useGetRequestCommentsQuery,
  useAddRequestCommentMutation,
} from "@/store/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

const RequestDetailsPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [addingComment, setAddingComment] = useState(false);
  const { token } = theme.useToken();
  const commentValue = Form.useWatch('comment', form) || '';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useGetRequestDetailsQuery(id!);
  const { data: historyData } = useGetRequestStatusHistoryQuery(id!);
  const { data: commentsData, refetch: refetchComments } = useGetRequestCommentsQuery(id!);
  const [addRequestComment] = useAddRequestCommentMutation();

  const request = data?.body;
  const statusHistory = historyData?.body || [];
  const comments = commentsData?.body || [];

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "orange";
      case "accepted":
        return "blue";
      case "in_progress":
        return "processing";
      case "completed":
        return "success";
      case "rejected":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return t('requests.pending');
      case "accepted":
        return t('requests.accepted');
      case "in_progress":
        return t('requests.inProgress');
      case "completed":
        return t('requests.completed');
      case "rejected":
        return t('requests.rejected');
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "default";
      case "medium":
        return "blue";
      case "high":
        return "orange";
      case "urgent":
        return "red";
      default:
        return "default";
    }
  };

  const handleAddComment = async (values: { comment: string }) => {
    try {
      setAddingComment(true);
      await addRequestComment({
        id: id!,
        comment: values.comment,
      }).unwrap();

      message.success(t('requests.commentAdded'));
      form.resetFields();
      refetchComments();
    } catch (error: any) {
      message.error(error?.data?.message || t('requests.commentError'));
    } finally {
      setAddingComment(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <Spin size="large" style={{ display: "block", margin: "50px auto" }} />
      </Card>
    );
  }

  if (!request) {
    return (
      <Card>
        <Alert
          message={t('requests.requestNotFound')}
          description={t('requests.errorLoadingDescription')}
          type="warning"
          showIcon
        />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/requests")}
          style={{ marginTop: 16 }}
        >
          {t('requests.backToRequests')}
        </Button>
      </Card>
    );
  }

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/requests")}
          style={{ marginBottom: 16 }}
        >
          {t('requests.backToRequests')}
        </Button>

        <Row gutter={24}>
          <Col span={16}>
            <Flex align="center" gap={12} style={{ marginBottom: 24 }}>
              <Title level={2} style={{ margin: 0 }}>
                Request #{request.req_no}
              </Title>
              <Tag 
                color={getStatusColor(request.status)}
                style={{ 
                  fontSize: 14, 
                  padding: '4px 12px',
                  fontWeight: 500,
                  borderRadius: 6
                }}
              >
                {getStatusLabel(request.status)}
              </Tag>
            </Flex>

            <Descriptions column={2} bordered>
              <Descriptions.Item label={t('requests.service')} span={2}>
                {request.service_name}
              </Descriptions.Item>
              <Descriptions.Item label={t('requests.requestTitle')} span={2}>
                {request.request_data?.title || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('requests.priorityLabel')}>
                <Tag color={getPriorityColor(request.request_data?.priority || '')}>
                  {request.request_data?.priority ? request.request_data.priority.charAt(0).toUpperCase() +
                    request.request_data.priority.slice(1) : 'N/A'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('requests.submittedOn')}>
                {request.created_at ? new Date(request.created_at).toLocaleString() : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label={t('requests.descriptionLabel')} span={2}>
                <Text style={{ whiteSpace: "pre-wrap" }}>
                  {request.request_data?.description || request.notes || '-'}
                </Text>
              </Descriptions.Item>
              {request.request_data?.attachments && request.request_data.attachments.length > 0 && (
                <Descriptions.Item label={t('requests.attachments')} span={2}>
                  {request.request_data.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginRight: 8 }}
                    >
                      <Tag
                        icon={<PaperClipOutlined />}
                        style={{ marginBottom: 4, cursor: 'pointer' }}
                      >
                        {attachment.originalName}
                      </Tag>
                    </a>
                  ))}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Question Answers Section */}
            {request.request_data?.questionAnswers && Array.isArray(request.request_data.questionAnswers) && request.request_data.questionAnswers.length > 0 && (
              <Card 
                title={t('requests.serviceQuestions')} 
                size="small" 
                style={{ marginTop: 16 }}
              >
                {request.request_data.questionAnswers.map((qa, index) => (
                  <div key={index} style={{ marginBottom: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>
                      {qa.question}
                    </Text>
                    {qa.type === 'attachment' ? (
                      qa.attachments && qa.attachments.length > 0 ? (
                        <div>
                          {qa.attachments.map((att, attIndex) => (
                            <a
                              key={attIndex}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ marginRight: 8 }}
                            >
                              <Tag
                                icon={<PaperClipOutlined />}
                                style={{ marginBottom: 4, cursor: 'pointer' }}
                              >
                                {att.originalName}
                              </Tag>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <Text type="secondary">{t('requests.noFilesUploaded')}</Text>
                      )
                    ) : (
                      <Text style={{ whiteSpace: 'pre-wrap' }}>
                        {qa.answer || <Text type="secondary">{t('requests.noAnswer')}</Text>}
                      </Text>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </Col>

          <Col span={8}>
            <Card title={t('requests.activityTimeline')} size="small">
              <Timeline
                items={statusHistory.map((item) => {
                  const getStatusLabel = (status: string) => {
                    switch (status) {
                      case 'pending': return t('requests.requestCreated');
                      case 'accepted': return t('requests.requestAccepted');
                      case 'in_progress': return t('requests.workStarted');
                      case 'completed': return t('requests.requestCompleted');
                      case 'rejected': return t('requests.requestRejected');
                      default: return status;
                    }
                  };

                  const getColor = (status: string) => {
                    switch (status) {
                      case 'pending': return 'green';
                      case 'accepted': return 'blue';
                      case 'in_progress': return 'blue';
                      case 'completed': return 'green';
                      case 'rejected': return 'red';
                      default: return 'gray';
                    }
                  };

                  return {
                    color: getColor(item.new_status),
                    children: (
                      <>
                        <Text strong>{getStatusLabel(item.new_status)}</Text>
                        <br />
                        <Text type="secondary">
                          {new Date(item.changed_at).toLocaleString()}
                        </Text>
                        {item.changed_by_name && (
                          <>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              by {item.changed_by_name}
                            </Text>
                          </>
                        )}
                      </>
                    ),
                  };
                })}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Chat-style Comments Section */}
      <Card 
        title={
          <Flex align="center" gap={8}>
            <CommentOutlined />
            <span>{t('requests.commentsUpdates')}</span>
            {comments.length > 0 && (
              <Tag color={token.colorPrimary} style={{ marginLeft: 8 }}>
                {comments.length}
              </Tag>
            )}
          </Flex>
        }
        styles={{ 
          body: { 
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 450,
          } 
        }}
      >
        {/* Chat Messages Area */}
        <div 
          style={{ 
            flex: 1,
            overflowY: 'auto',
            padding: comments.length === 0 ? '24px' : '16px 20px',
            backgroundColor: token.colorBgLayout,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: comments.length === 0 ? 'center' : 'flex-start',
          }}
        >
          {comments.length === 0 ? (
            <div style={{ 
              textAlign: 'center',
              padding: '40px 20px',
              backgroundColor: token.colorBgContainer,
              borderRadius: 12,
              border: `1px dashed ${token.colorBorder}`,
            }}>
              <CommentOutlined style={{ fontSize: 48, color: token.colorTextTertiary, marginBottom: 16 }} />
              <div>
                <Text style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
                  {t('requests.noComments', { defaultValue: 'No comments yet' })}
                </Text>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  {t('requests.startConversation', { defaultValue: 'Start the conversation by adding a comment below' })}
                </Text>
              </div>
            </div>
          ) : (
            <>
              {comments.map((comment) => {
                const isTeamMember = comment.sender_type === 'team_member';
                const isOwnMessage = !isTeamMember;
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
                      <Avatar 
                        size={32}
                        icon={isTeamMember ? <TeamOutlined /> : <UserOutlined />}
                        style={{ 
                          backgroundColor: isTeamMember ? token.colorPrimary : token.colorSuccess,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <Flex 
                          align="center" 
                          gap={8} 
                          style={{ 
                            marginBottom: 4,
                            flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                          }}
                        >
                          <Text strong style={{ fontSize: 13 }}>{comment.sender_name}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </Flex>
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: isOwnMessage ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            backgroundColor: isOwnMessage ? token.colorPrimary : token.colorBgContainer,
                            color: isOwnMessage ? '#fff' : token.colorText,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            wordBreak: 'break-word',
                          }}
                        >
                          <Text 
                            style={{ 
                              whiteSpace: 'pre-wrap', 
                              lineHeight: 1.5,
                              color: 'inherit',
                            }}
                          >
                            {comment.comment}
                          </Text>
                        </div>
                        <Text 
                          type="secondary" 
                          style={{ 
                            fontSize: 10, 
                            marginTop: 4, 
                            display: 'block',
                            textAlign: isOwnMessage ? 'right' : 'left',
                          }}
                        >
                          {new Date(comment.created_at).toLocaleDateString()}
                        </Text>
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
          }}
        >
          {(request.status === "completed" || request.status === "rejected") ? (
            <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic', display: 'block', textAlign: 'center', padding: '8px 0' }}>
              {request.status === "completed" 
                ? t('requests.requestCompletedNoComments', { defaultValue: 'This request has been completed. Comments are disabled.' })
                : t('requests.requestRejectedNoComments', { defaultValue: 'This request has been rejected. Comments are disabled.' })}
            </Text>
          ) : (
            <Form form={form} onFinish={handleAddComment}>
              <Flex gap={12} align="flex-end">
                <Form.Item
                  name="comment"
                  rules={[{ required: true, message: t('requests.commentRequired') }]}
                  style={{ marginBottom: 0, flex: 1 }}
                >
                  <TextArea
                    rows={2}
                    placeholder={t('requests.addCommentPlaceholder')}
                    maxLength={5000}
                    style={{ 
                      borderRadius: 20,
                      resize: 'none',
                      paddingRight: 50,
                    }}
                    onPressEnter={(e) => {
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
                  loading={addingComment}
                  size="large"
                  style={{ marginBottom: 4 }}
                />
              </Flex>
              <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                {commentValue.length}/5000 · {t('requests.pressEnterToSend') || 'Press Enter to send, Shift+Enter for new line'}
              </Text>
            </Form>
          )}
        </div>
      </Card>
    </>
  );
};

export default RequestDetailsPage;
