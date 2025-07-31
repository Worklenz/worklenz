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
import {
  useGetRequestDetailsQuery,
  useUpdateRequestMutation,
} from "@/store/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

const RequestDetailsPage: React.FC = () => {
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
      await updateRequest({
        id: id!,
        data: {
          // Add comment logic here
          description: `${request?.description}\n\n---\nComment: ${values.comment}`,
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
                {request.service}
              </Descriptions.Item>
              <Descriptions.Item label="Title" span={2}>
                {request.title}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(request.status)}>
                  {request.status.charAt(0).toUpperCase() +
                    request.status.slice(1).replace("_", " ")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityColor(request.priority)}>
                  {request.priority.charAt(0).toUpperCase() +
                    request.priority.slice(1)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Created Date">
                {new Date(request.time).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label="Created Time">
                {new Date(request.time).toLocaleTimeString()}
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                <Text style={{ whiteSpace: "pre-wrap" }}>
                  {request.description}
                </Text>
              </Descriptions.Item>
              {request.attachments && request.attachments.length > 0 && (
                <Descriptions.Item label="Attachments" span={2}>
                  {request.attachments.map((attachment, index) => (
                    <Tag
                      key={index}
                      icon={<PaperClipOutlined />}
                      style={{ marginBottom: 4 }}
                    >
                      {attachment}
                    </Tag>
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
                          {new Date(request.time).toLocaleString()}
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
                                Status changed to accepted
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
                                Status changed to in progress
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
                                All work has been completed
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
                                Request was not accepted
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
