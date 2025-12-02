import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  message,
  Typography,
  Row,
  Col,
  ArrowLeftOutlined,
} from "@/shared/antd-imports";
import { useNavigate } from "react-router-dom";
import { useGetServicesQuery, useCreateRequestMutation } from "@/store/api";
import FileUploader from "@/components/FileUploader";
import clientPortalAPI from "@/services/api";

const { Title } = Typography;
const { TextArea } = Input;

interface UploadedFileInfo {
  id?: string;
  url: string;
  filename: string;
  originalName: string;
  fileType: string;
  size: number;
  uploadedAt: string;
  purpose: string;
}

interface RequestFormValues {
  service_id: string;
  title: string;
  description: string;
  priority: string;
}

const NewRequestPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [attachments, setAttachments] = useState<UploadedFileInfo[]>([]);
  
  // Store the markAsSubmitted callback from FileUploader
  const markAsSubmittedRef = useRef<(() => void) | null>(null);

  const { data: servicesData, isLoading: servicesLoading } =
    useGetServicesQuery();
  const [createRequest, { isLoading: creating }] = useCreateRequestMutation();

  const onFinish = async (values: RequestFormValues) => {
    try {
      // Collect attachment IDs for linking after request creation
      const attachmentIds = attachments
        .filter((file) => file.id)
        .map((file) => file.id as string);

      const requestData = {
        serviceId: values.service_id,
        requestData: {
          title: values.title,
          description: values.description,
          priority: values.priority,
          // Include both attachment IDs and legacy attachment data for backward compatibility
          attachmentIds,
          attachments: attachments.map((file) => ({
            id: file.id,
            url: file.url,
            filename: file.filename,
            originalName: file.originalName,
            size: file.size,
          })),
        },
        notes: values.description,
      };

      const result = await createRequest(requestData).unwrap();
      const requestId = result?.body?.id;
      
      // Link attachments to the newly created request if we have attachment IDs
      if (attachmentIds.length > 0 && requestId) {
        try {
          await clientPortalAPI.linkAttachmentsToRequest(requestId, attachmentIds);
        } catch (linkError) {
          console.warn("Failed to link attachments to request:", linkError);
          // Don't fail the whole request creation if linking fails
        }
      }

      // Mark as submitted to prevent cleanup of uploaded files
      markAsSubmittedRef.current?.();
      
      message.success(t("requests.createSuccess"));
      navigate("/requests");
    } catch (error) {
      message.error(t("requests.createError"));
      console.error("Error creating request:", error);
    }
  };

  const onCancel = () => {
    navigate("/requests");
  };

  const handleFilesChange = (files: UploadedFileInfo[]) => {
    setAttachments(files);
  };

  return (
    <Card>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={onCancel}
        style={{ marginBottom: 16 }}
      >
        {t("requests.backToRequests")}
      </Button>

      <Title level={2} style={{ marginBottom: 24 }}>
        {t("requests.createNewRequest")}
      </Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ priority: "medium" }}
        style={{ maxWidth: 800 }}
      >
        <Row gutter={24}>
          <Col span={24}>
            <Form.Item
              name="service_id"
              label={t("requests.serviceLabel")}
              rules={[{ required: true, message: t("requests.selectServiceRequired") }]}
            >
              <Select
                placeholder={t("requests.selectService")}
                loading={servicesLoading}
                showSearch
                optionFilterProp="children"
              >
                {servicesData?.body?.map(
                  (service: { id: string; name: string }) => (
                    <Select.Option key={service.id} value={service.id}>
                      {service.name}
                    </Select.Option>
                  )
                )}
              </Select>
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="title"
              label={t("requests.requestTitleLabel")}
              rules={[{ required: true, message: t("requests.titleRequired") }]}
            >
              <Input placeholder={t("requests.enterTitle")} />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="description"
              label={t("requests.descriptionLabel")}
              rules={[
                { required: true, message: t("requests.descriptionRequired") },
              ]}
            >
              <TextArea
                rows={4}
                placeholder={t("requests.describeRequest")}
                showCount
                maxLength={2000}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="priority"
              label={t("requests.priorityLabel")}
              rules={[{ required: true, message: t("requests.priorityRequired") }]}
            >
              <Select placeholder={t("requests.selectPriority")}>
                <Select.Option value="low">{t("requests.priorityLow")}</Select.Option>
                <Select.Option value="medium">{t("requests.priorityMedium")}</Select.Option>
                <Select.Option value="high">{t("requests.priorityHigh")}</Select.Option>
                <Select.Option value="urgent">{t("requests.priorityUrgent")}</Select.Option>
              </Select>
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label={t("requests.attachmentsLabel")}
            >
              <FileUploader
                purpose="request"
                maxFiles={5}
                acceptedFileTypes=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                maxFileSize={10}
                onFilesChange={handleFilesChange}
                showFileList={true}
                cleanupOnUnmount={true}
                onSubmitReady={(markFn) => { markAsSubmittedRef.current = markFn; }}
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={creating}
                style={{ marginRight: 8 }}
              >
                {t("requests.submitRequest")}
              </Button>
              <Button onClick={onCancel}>{t("requests.cancel")}</Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default NewRequestPage;
