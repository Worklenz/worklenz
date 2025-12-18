import React, { useState } from "react";
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
} from "@/shared/antd-imports";
import {
  ArrowLeftOutlined,
  SendOutlined,
  PaperClipOutlined,
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

  const { data, isLoading, refetch } = useGetRequestDetailsQuery(id!);
  const { data: historyData } = useGetRequestStatusHistoryQuery(id!);
  const { data: commentsData, refetch: refetchComments } = useGetRequestCommentsQuery(id!);
  const [addRequestComment] = useAddRequestCommentMutation();

  const request = data?.body;
  const statusHistory = historyData?.body || [];
  const comments = commentsData?.body || [];

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
            <Title level={2} style={{ marginBottom: 24 }}>
              Request #{request.req_no}
            </Title>

            <Descriptions column={2} bordered>
              <Descriptions.Item label={t('requests.service')} span={2}>
                {request.service_name}
              </Descriptions.Item>
              <Descriptions.Item label={t('requests.requestTitle')} span={2}>
                {request.request_data?.title || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('requests.status')}>
                <Tag color={getStatusColor(request.status)}>
                  {request.status.charAt(0).toUpperCase() +
                    request.status.slice(1).replace("_", " ")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('requests.priorityLabel')}>
                <Tag color={getPriorityColor(request.request_data?.priority || '')}>
                  {request.request_data?.priority ? request.request_data.priority.charAt(0).toUpperCase() +
                    request.request_data.priority.slice(1) : 'N/A'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('requests.submittedOn')} span={2}>
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

      <Card title={t('requests.commentsUpdates')}>
        {/* Comments List */}
        {comments.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  padding: 16,
                  marginBottom: 16,
                  backgroundColor: 'var(--ant-color-bg-container)',
                  border: '1px solid var(--ant-color-border-secondary)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>{comment.sender_name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(comment.created_at).toLocaleString()}
                  </Text>
                </div>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{comment.comment}</Text>
              </div>
            ))}
          </div>
        )}

        {/* Add Comment Form */}
        <Form form={form} onFinish={handleAddComment}>
          <Form.Item
            name="comment"
            rules={[{ required: true, message: t('requests.commentRequired') }]}
          >
            <TextArea
              rows={3}
              placeholder={t('requests.addCommentPlaceholder')}
              disabled={
                request.status === "completed" || request.status === "rejected"
              }
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={addingComment}
              disabled={
                request.status === "completed" || request.status === "rejected"
              }
            >
              {t('requests.addComment')}
            </Button>
          </Form.Item>
        </Form>

        {request.status === "completed" && (
          <Alert
            message={t('requests.requestCompletedMessage')}
            description={t('requests.requestCompletedDescription')}
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {request.status === "rejected" && (
          <Alert
            message={t('requests.requestRejectedMessage')}
            description={t('requests.requestRejectedDescription')}
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    </>
  );
};

export default RequestDetailsPage;
