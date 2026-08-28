import React, { useState, useRef, useEffect } from "react";
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
  Radio,
  Divider,
  Spin,
} from "@/shared/antd-imports";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGetServicesQuery, useCreateRequestMutation, useGetServiceDetailsQuery } from "@/store/api";
import FileUploader from "@/components/FileUploader";
import clientPortalAPI from "@/services/api";

const { Title, Text } = Typography;
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

interface RequestFormQuestion {
  question: string;
  type: 'text' | 'multipleChoice' | 'attachment';
  answer: string | string[] | null;
}

interface QuestionAnswerData {
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
}

const NewRequestPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    searchParams.get('service') || null
  );
  const [questionAttachments, setQuestionAttachments] = useState<Record<number, UploadedFileInfo[]>>({});
  
  // Store the markAsSubmitted callback from FileUploader (for question attachments)
  const questionMarkAsSubmittedRefs = useRef<Record<number, (() => void) | null>>({});

  const { data: servicesData, isLoading: servicesLoading } =
    useGetServicesQuery();
  const { data: serviceDetailsData, isLoading: serviceDetailsLoading } = 
    useGetServiceDetailsQuery(selectedServiceId || '', { skip: !selectedServiceId });
  const [createRequest, { isLoading: creating }] = useCreateRequestMutation();

  // Get the request form questions from the selected service
  const requestFormQuestions: RequestFormQuestion[] = 
    serviceDetailsData?.body?.serviceData?.request_form || [];

  // Set initial service from URL params
  useEffect(() => {
    const serviceFromUrl = searchParams.get('service');
    if (serviceFromUrl) {
      setSelectedServiceId(serviceFromUrl);
      form.setFieldValue('service_id', serviceFromUrl);
    }
  }, [searchParams, form]);

  // Handle service selection change
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    // Clear question-related form fields when service changes
    requestFormQuestions.forEach((_, index) => {
      form.setFieldValue(`question_${index}`, undefined);
    });
    setQuestionAttachments({});
  };

  // Handle question attachment changes
  const handleQuestionAttachmentChange = (questionIndex: number, files: UploadedFileInfo[]) => {
    setQuestionAttachments(prev => ({
      ...prev,
      [questionIndex]: files
    }));
  };

  const onFinish = async (values: Record<string, unknown>) => {
    try {
      // Validate required fields
      if (!values.service_id) {
        message.error(t("requests.selectServiceRequired") || "Please select a service");
        return;
      }
      if (!values.title) {
        message.error(t("requests.titleRequired") || "Please enter a title");
        return;
      }
      if (!values.description) {
        message.error(t("requests.descriptionRequired") || "Please enter a description");
        return;
      }

      // Collect question attachments IDs
      const attachmentIds: string[] = [];
      Object.values(questionAttachments).forEach(files => {
        files.forEach(file => {
          if (file.id) attachmentIds.push(file.id);
        });
      });

      // Build question answers array
      const questionAnswers: QuestionAnswerData[] = requestFormQuestions.map((q, index) => {
        const fieldValue = values[`question_${index}`];
        let answer: string | string[] | null = null;

        if (q.type === 'text') {
          answer = fieldValue as string || null;
        } else if (q.type === 'multipleChoice') {
          answer = fieldValue as string || null;
        } else if (q.type === 'attachment') {
          // For attachment type, store the file info
          const files = questionAttachments[index] || [];
          return {
            question: q.question,
            type: q.type,
            answer: null,
            attachments: files.map(f => ({
              id: f.id,
              url: f.url,
              filename: f.filename,
              originalName: f.originalName,
              size: f.size,
            }))
          };
        }

        return {
          question: q.question,
          type: q.type,
          answer
        };
      });

      const requestData = {
        serviceId: values.service_id as string,
        requestData: {
          title: values.title as string,
          description: values.description as string,
          priority: values.priority as string,
          // Include question answers
          questionAnswers: questionAnswers.length > 0 ? questionAnswers : undefined,
          // Include attachment IDs from question attachments
          attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        },
        notes: values.description as string,
      };

      console.log('[NewRequestPage] Submitting request with data:', requestData);

      const result = await createRequest(requestData).unwrap();
      const requestId = result?.body?.id;
      
      console.log('[NewRequestPage] Request created successfully:', result);
      
      // Link attachments to the newly created request if we have attachment IDs
      if (attachmentIds.length > 0 && requestId) {
        try {
          await clientPortalAPI.linkAttachmentsToRequest(requestId, attachmentIds);
        } catch (linkError) {
          console.warn("Failed to link attachments to request:", linkError);
          // Don't fail the whole request creation if linking fails
        }
      }

      // Mark question attachments as submitted to prevent cleanup
      Object.values(questionMarkAsSubmittedRefs.current).forEach(fn => fn?.());
      
      message.success(t("requests.createSuccess") || "Request submitted successfully");
      navigate("/requests");
    } catch (error: any) {
      console.error("[NewRequestPage] Error creating request:", error);
      const errorMessage = error?.data?.message || error?.message || t("requests.createError") || "Failed to submit request";
      message.error(errorMessage);
    }
  };

  const onCancel = () => {
    navigate("/requests");
  };

  // Render a question field based on its type
  const renderQuestionField = (question: RequestFormQuestion, index: number) => {
    const fieldName = `question_${index}`;

    switch (question.type) {
      case 'text':
        return (
          <Form.Item
            key={fieldName}
            name={fieldName}
            label={question.question}
            rules={[{ required: false }]}
          >
            <TextArea
              rows={3}
              placeholder={t("requests.enterAnswer")}
              maxLength={1000}
            />
          </Form.Item>
        );

      case 'multipleChoice': {
        const options = Array.isArray(question.answer) ? question.answer : [];
        return (
          <Form.Item
            key={fieldName}
            name={fieldName}
            label={question.question}
            rules={[{ required: false }]}
          >
            <Radio.Group>
              {options.map((option, optIndex) => (
                <Radio key={optIndex} value={option} style={{ display: 'block', marginBottom: 8 }}>
                  {option}
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
        );
      }

      case 'attachment':
        return (
          <Form.Item
            key={fieldName}
            label={question.question}
            rules={[{ required: false }]}
          >
            <FileUploader
              purpose="question_attachment"
              maxFiles={3}
              acceptedFileTypes=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              maxFileSize={10}
              onFilesChange={(files) => handleQuestionAttachmentChange(index, files)}
              showFileList={true}
              cleanupOnUnmount={true}
              onSubmitReady={(markFn) => { questionMarkAsSubmittedRefs.current[index] = markFn; }}
            />
          </Form.Item>
        );

      default:
        return null;
    }
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
                onChange={handleServiceChange}
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

          {/* Dynamic Service Questions Section */}
          {selectedServiceId && requestFormQuestions.length > 0 && (
            <Col span={24}>
              <Divider orientation="left">
                <Text strong>{t("requests.serviceQuestions")}</Text>
              </Divider>
              {serviceDetailsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {t("requests.loadingQuestions")}
                  </Text>
                </div>
              ) : (
                requestFormQuestions.map((question, index) => (
                  <div key={index}>
                    {renderQuestionField(question, index)}
                  </div>
                ))
              )}
            </Col>
          )}

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
