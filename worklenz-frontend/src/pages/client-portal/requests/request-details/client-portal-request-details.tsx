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
} from '@/shared/antd-imports';
import { ArrowLeftOutlined, DownOutlined, PaperClipOutlined } from '@ant-design/icons';
import { colors } from '../../../../styles/colors';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetRequestDetailsQuery, useUpdateOrganizationRequestStatusMutation } from '../../../../api/client-portal/client-portal-api';
import { message } from 'antd';
import { durationDateFormat } from '../../../../utils/durationDateFormat';
import ChatBoxWrapper from '../../chats/chat-container/chat-box/chat-box-wrapper';

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

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch request details from API
  const { data: requestData, isLoading } = useGetRequestDetailsQuery(id || '');
  const selectedRequest = requestData?.body;

  // Status update mutation
  const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateOrganizationRequestStatusMutation();

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
      label: t1('submissionTab'),
      children: (
        <Flex vertical gap={24} style={{ height: 'calc(100vh - 400px)', overflowY: 'auto', paddingRight: 8 }}>
          {/* Title */}
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('titleLabel') || 'Title'}</Typography.Text>
            <Typography.Text>{requestInfo.title || '-'}</Typography.Text>
          </Flex>

          {/* Service */}
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('serviceLabel') || 'Service'}</Typography.Text>
            <Typography.Text>{selectedRequest?.service_name || '-'}</Typography.Text>
          </Flex>

          {/* Client */}
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('clientLabel') || 'Client'}</Typography.Text>
            <Typography.Text style={{ textTransform: 'capitalize' }}>
              {selectedRequest?.client_name || '-'}
            </Typography.Text>
          </Flex>

          {/* Priority */}
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('priorityLabel') || 'Priority'}</Typography.Text>
            {requestInfo.priority ? (
              <Tag color={getPriorityColor(requestInfo.priority)} style={{ width: 'fit-content', textTransform: 'capitalize' }}>
                {requestInfo.priority}
              </Tag>
            ) : (
              <Typography.Text>-</Typography.Text>
            )}
          </Flex>

          {/* Description */}
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('descriptionLabel') || 'Description'}</Typography.Text>
            <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {requestInfo.description || selectedRequest?.notes || '-'}
            </Typography.Paragraph>
          </Flex>

          {/* Created At */}
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('createdAtLabel') || 'Created At'}</Typography.Text>
            <Typography.Text>
              {selectedRequest?.created_at
                ? durationDateFormat(new Date(selectedRequest.created_at))
                : '-'}
            </Typography.Text>
          </Flex>

          {/* Attachments */}
          {attachments.length > 0 && (
            <Flex vertical gap={8}>
              <Typography.Text style={{ fontWeight: 600 }}>
                {t1('attachmentsLabel') || 'Attachments'} ({attachments.length})
              </Typography.Text>
              <Flex vertical gap={8}>
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
                      gap={8}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #d9d9d9',
                        background: '#fafafa',
                        cursor: 'pointer',
                        width: 'fit-content',
                      }}
                    >
                      <PaperClipOutlined />
                      <Typography.Text ellipsis style={{ maxWidth: 300 }}>
                        {attachment.originalName}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        ({formatFileSize(attachment.size)})
                      </Typography.Text>
                    </Flex>
                  </a>
                ))}
              </Flex>
            </Flex>
          )}
        </Flex>
      ),
    },
    {
      key: 'chat',
      label: t1('chatTab'),
      children: (
        <div style={{ height: 'calc(100vh - 400px)', overflow: 'hidden' }}>
          <ChatBoxWrapper />
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
      <Card style={{ height: 'cal(100vh - 330px)' }}>
        <Tabs
          defaultActiveKey="submission"
          items={items}
          style={{
            height: 'calc(100vh - 330px)',
            overflow: 'hidden',
          }}
        />
      </Card>
    </Flex>
  );
};

export default ClientPortalRequestDetails;
