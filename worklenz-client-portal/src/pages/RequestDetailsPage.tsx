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
  useUpdateRequestMutation,
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
  const [updateRequest] = useUpdateRequestMutation();

  const request = data?.body;

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
      // In a real implementation, this would add a comment to the request
      const currentNotes = request?.notes || '';
      await updateRequest({
        id: id!,
        data: {
          // Add comment logic here
          notes: `${currentNotes}\n\n---\nComment: ${values.comment}`,
        },
      }).unwrap();

      message.success("Comment added successfully");
      form.resetFields();
      refetch();
    } catch {
      message.error("Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  };

  // Error handling removed for now
  // eslint-disable-next-line no-constant-condition
  if (false) {
    return (
      <Card>
        <Alert
          message="Error loading request"
          description="Failed to load request details. Please try again."
          type="error"
          showIcon
        />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/requests")}
          style={{ marginTop: 16 }}
        >
          Back to Requests
        </Button>
      </Card>
    );
  }

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
          message="Request not found"
          description="The requested item could not be found."
          type="warning"
          showIcon
        />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/requests")}
          style={{ marginTop: 16 }}
        >
          Back to Requests
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
          Back to Requests
        </Button>

        <Row gutter={24}>
          <Col span={16}>
            <Title level={2} style={{ marginBottom: 24 }}>
              Request #{request.req_no}
            </Title>

            <Descriptions column={2} bordered>
              <Descriptions.Item label="Service" span={2}>
                {request.service_name}
              </Descriptions.Item>
              <Descriptions.Item label="Title" span={2}>
                {request.request_data?.title || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(request.status)}>
                  {request.status.charAt(0).toUpperCase() +
                    request.status.slice(1).replace("_", " ")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityColor(request.request_data?.priority || '')}>
                  {request.request_data?.priority ? request.request_data.priority.charAt(0).toUpperCase() +
                    request.request_data.priority.slice(1) : 'N/A'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Created Date">
                {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Created Time">
                {request.created_at ? new Date(request.created_at).toLocaleTimeString() : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                <Text style={{ whiteSpace: "pre-wrap" }}>
                  {request.request_data?.description || request.notes || '-'}
                </Text>
              </Descriptions.Item>
              {request.request_data?.attachments && request.request_data.attachments.length > 0 && (
                <Descriptions.Item label="Attachments" span={2}>
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
          </Col>

          <Col span={8}>
            <Card title="Activity Timeline" size="small">
              <Timeline
                items={[
                  {
                    color: "green",
                    children: (
                      <>
                        <Text strong>Request Created</Text>
                        <br />
                        <Text type="secondary">
                          {request.created_at ? new Date(request.created_at).toLocaleString() : 'N/A'}
                        </Text>
                      </>
                    ),
                  },
                  ...(request.status === "accepted" ||
                  request.status === "in_progress" ||
                  request.status === "completed"
                    ? [
                        {
                          color: "blue",
                          children: (
                            <>
                              <Text strong>Request Accepted</Text>
                              <br />
                              <Text type="secondary">
                                {request.updated_at ? new Date(request.updated_at).toLocaleString() : 'N/A'}
                              </Text>
                            </>
                          ),
                        },
                      ]
                    : []),
                  ...(request.status === "in_progress" ||
                  request.status === "completed"
                    ? [
                        {
                          color: "blue",
                          children: (
                            <>
                              <Text strong>Work Started</Text>
                              <br />
                              <Text type="secondary">
                                {request.updated_at ? new Date(request.updated_at).toLocaleString() : 'N/A'}
                              </Text>
                            </>
                          ),
                        },
                      ]
                    : []),
                  ...(request.status === "completed"
                    ? [
                        {
                          color: "green",
                          children: (
                            <>
                              <Text strong>Request Completed</Text>
                              <br />
                              <Text type="secondary">
                                {request.completed_at ? new Date(request.completed_at).toLocaleString() : (request.updated_at ? new Date(request.updated_at).toLocaleString() : 'N/A')}
                              </Text>
                            </>
                          ),
                        },
                      ]
                    : []),
                  ...(request.status === "rejected"
                    ? [
                        {
                          color: "red",
                          children: (
                            <>
                              <Text strong>Request Rejected</Text>
                              <br />
                              <Text type="secondary">
                                {request.updated_at ? new Date(request.updated_at).toLocaleString() : 'N/A'}
                              </Text>
                            </>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card title="Comments & Updates">
        <Form form={form} onFinish={handleAddComment}>
          <Form.Item
            name="comment"
            rules={[{ required: true, message: "Please enter a comment" }]}
          >
            <TextArea
              rows={3}
              placeholder="Add a comment or update..."
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
              Add Comment
            </Button>
          </Form.Item>
        </Form>

        {request.status === "completed" && (
          <Alert
            message="This request has been completed"
            description="No further updates can be made to completed requests."
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {request.status === "rejected" && (
          <Alert
            message="This request has been rejected"
            description="No further updates can be made to rejected requests."
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
