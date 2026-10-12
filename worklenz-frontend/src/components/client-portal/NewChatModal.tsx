import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Typography,
  Space,
  message,
  Divider,
  Select,
  Spin,
} from '@/shared/antd-imports';
import { MessageOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useCreateOrganizationChatMutation,
  useGetClientsQuery,
} from '@/api/client-portal/client-portal-api';

const { TextArea } = Input;

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (chatId: string) => void;
  clientId?: string; // Required for organization-side chat creation
}

interface NewChatForm {
  clientId?: string;
  subject: string;
  message: string;
}

const NewChatModal: React.FC<NewChatModalProps> = ({
  open,
  onClose,
  onSuccess,
  clientId: propClientId,
}) => {
  const { t } = useTranslation('client-portal-chats');
  const { t: tCommon } = useTranslation('common');
  const [form] = Form.useForm<NewChatForm>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(propClientId);

  const [createChat] = useCreateOrganizationChatMutation();

  // Fetch clients list when no clientId is provided as prop
  const { data: clientsData, isLoading: isLoadingClients } = useGetClientsQuery(
    { page: 1, limit: 100, status: 'active' },
    { skip: !!propClientId }
  );

  const clients = clientsData?.body?.clients || [];

  // Reset selected client when modal opens/closes or prop changes
  useEffect(() => {
    if (open) {
      setSelectedClientId(propClientId);
      if (propClientId) {
        form.setFieldValue('clientId', propClientId);
      }
    }
  }, [open, propClientId, form]);

  const handleSubmit = async (values: NewChatForm) => {
    const effectiveClientId = propClientId || values.clientId || selectedClientId;

    if (!effectiveClientId) {
      message.error(t('clientIdRequired') || 'Please select a client to start a chat');
      return;
    }

    try {
      setIsSubmitting(true);

      // For organization-side, create chat for the specified client
      const response = await createChat({
        clientId: effectiveClientId,
        recipientType: 'team',
        recipientId: 'organization',
        subject: values.subject,
        message: values.message,
      }).unwrap();

      message.success(t('newChatCreatedSuccessfully') || 'Conversation started successfully!');
      form.resetFields();
      onClose();
      // Call onSuccess with chatId to open the new chat and refresh the list
      if (response?.chatId) {
        onSuccess?.(response.chatId);
      }
    } catch (error) {
      console.error('Failed to create new chat:', error);
      message.error(t('newChatFailed') || 'Failed to create chat. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <MessageOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
          <Typography.Text strong style={{ fontSize: '16px' }}>
            {t('newChat') || 'New Chat'}
          </Typography.Text>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnHidden
      maskClosable={false}
    >
      <Typography.Text
        type="secondary"
        style={{
          display: 'block',
          marginBottom: 24,
          fontSize: '13px',
        }}
      >
        {t('newChatDescription') || 'Start a new conversation with your team'}
      </Typography.Text>

      <Divider style={{ margin: '0 0 24px 0' }} />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        validateTrigger={['onBlur', 'onSubmit']}
      >
        {/* Client selector - only show when clientId is not provided as prop */}
        {!propClientId && (
          <Form.Item
            name="clientId"
            label={
              <Typography.Text strong style={{ fontSize: '14px' }}>
                {t('selectClient') || 'Select Client'}
              </Typography.Text>
            }
            tooltip={t('selectClientHelper') || 'Choose which client to start a conversation with'}
            rules={[{ required: true, message: t('clientRequired') || 'Please select a client' }]}
          >
            <Select
              placeholder={t('selectClientPlaceholder') || 'Select a client...'}
              size="large"
              showSearch
              optionFilterProp="label"
              loading={isLoadingClients}
              notFoundContent={
                isLoadingClients ? <Spin size="small" /> : t('noClientsFound') || 'No clients found'
              }
              onChange={value => setSelectedClientId(value)}
              style={{ borderRadius: '6px' }}
              options={clients.map(client => ({
                value: client.id,
                label: (
                  <Space>
                    <UserOutlined />
                    <span>{client.name}</span>
                    {client.company_name && (
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        ({client.company_name})
                      </Typography.Text>
                    )}
                  </Space>
                ),
              }))}
            />
          </Form.Item>
        )}

        <Form.Item
          name="subject"
          label={
            <Typography.Text strong style={{ fontSize: '14px' }}>
              {t('subject') || 'Subject'}
            </Typography.Text>
          }
          tooltip={t('subjectHelper') || 'A clear subject helps your team respond faster'}
          rules={[
            { required: true, message: t('subjectRequired') || 'Please enter a subject' },
            { min: 3, message: t('subjectMinLength') || 'Subject must be at least 3 characters' },
            {
              max: 100,
              message: t('subjectMaxLength') || 'Subject must be less than 100 characters',
            },
          ]}
        >
          <Input
            placeholder={t('subjectPlaceholder') || 'Enter a brief subject for your message'}
            maxLength={100}
            showCount
            size="large"
            style={{
              borderRadius: '6px',
            }}
          />
        </Form.Item>

        <Form.Item
          name="message"
          label={
            <Typography.Text strong style={{ fontSize: '14px' }}>
              {t('message') || 'Message'}
            </Typography.Text>
          }
          tooltip={t('messageHelper') || 'Describe your question or request in detail'}
          rules={[
            { required: true, message: t('messageRequired') || 'Please enter a message' },
            {
              max: 1000,
              message: t('messageMaxLength') || 'Message must be less than 1000 characters',
            },
          ]}
        >
          <TextArea
            placeholder={t('messagePlaceholder') || 'Type your message here...'}
            rows={5}
            maxLength={1000}
            showCount
            style={{
              borderRadius: '6px',
              resize: 'vertical',
            }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button
              onClick={handleCancel}
              disabled={isSubmitting}
              size="large"
              style={{
                minWidth: '100px',
              }}
            >
              {tCommon('cancel') || 'Cancel'}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              icon={<MessageOutlined />}
              size="large"
              style={{
                minWidth: '140px',
              }}
            >
              {t('sendMessage') || 'Send Message'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default NewChatModal;
