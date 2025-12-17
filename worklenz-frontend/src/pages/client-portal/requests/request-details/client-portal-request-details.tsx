import React from 'react';
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
  MessageOutlined,
} from '@ant-design/icons';
import { colors } from '../../../../styles/colors';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetRequestDetailsQuery, useUpdateOrganizationRequestStatusMutation } from '../../../../api/client-portal/client-portal-api';
import { message } from 'antd';
import { durationDateFormat } from '../../../../utils/durationDateFormat';
import RequestChatWrapper from './request-chat-wrapper';

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
  const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateOrganizationRequestStatusMutation();

  // Check if request can be invoiced (not pending or rejected)
  const canCreateInvoice = selectedRequest?.status && 
    !['pending', 'rejected'].includes(selectedRequest.status);

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
              <Typography.Title level={4} style={{ margin: 0, marginBottom: 4 }}>
                {requestInfo.title || t1('untitledRequest')}
              </Typography.Title>
              <Flex align="center" gap={16} wrap="wrap">
                <Flex align="center" gap={6}>
                  <AppstoreOutlined style={{ color: token.colorTextSecondary, fontSize: 14 }} />
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {selectedRequest?.service_name || '-'}
                  </Typography.Text>
                </Flex>
                <Flex align="center" gap={6}>
                  <UserOutlined style={{ color: token.colorTextSecondary, fontSize: 14 }} />
                  <Typography.Text type="secondary" style={{ fontSize: 13, textTransform: 'capitalize' }}>
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
                body: { padding: '16px 24px' } 
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
                body: { padding: '16px 24px' } 
              }}
            >
              <Flex gap={12} wrap="wrap">
                {attachments.map((attachment) => (
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
                body: { padding: '16px 24px' } 
              }}
            >
              <Flex vertical gap={16}>
                {requestInfo.questionAnswers.map((qa: {
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
                }, index: number) => (
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
                ))}
              </Flex>
            </Card>
          )}
        </Flex>
      ),
    },
    {
      key: 'chat',
      label: (
        <Flex align="center" gap={6}>
          <MessageOutlined />
          {t1('chatTab')}
        </Flex>
      ),
      children: (
        <div style={{ height: 'calc(100vh - 420px)', overflow: 'hidden', borderRadius: 12 }}>
          <RequestChatWrapper 
            clientId={selectedRequest?.client_id} 
            clientName={selectedRequest?.client_name}
          />
        </div>
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
          {canCreateInvoice && (
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={handleCreateInvoice}
            >
              {t1('createInvoiceButton') || 'Create Invoice'}
            </Button>
          )}
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
            variant="borderless"
            labelRender={value => (
              <Typography.Text style={{ color: colors.skyBlue }}>{value.label}</Typography.Text>
            )}
            suffixIcon={<DownOutlined style={{ color: colors.skyBlue }} />}
          />
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
