import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Space,
  message,
  Spin,
} from '@/shared/antd-imports';
import { MessageOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useGetClientsQuery,
  useSendMessageMutation,
} from '@/api/client-portal/client-portal-api';

const { TextArea } = Input;
const { Option } = Select;

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (chatId: string) => void;
}

interface NewChatForm {
  recipientType: 'client' | 'team';
  recipientId: string;
  subject: string;
  message: string;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation(['client-portal-chats', 'common']);
  const [form] = Form.useForm<NewChatForm>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get available clients for team members to message
  const { data: clientsData, isLoading: isLoadingClients } = useGetClientsQuery({});
  const [sendMessage] = useSendMessageMutation();

  const handleSubmit = async (values: NewChatForm) => {
    try {
      setIsSubmitting(true);

      // Create initial message data
      const messageData = {
        content: values.message,
        subject: values.subject,
        recipientType: values.recipientType,
        recipientId: values.recipientId,
      };

      // For now, we'll use a temporary chat ID until the backend creates the chat
      // In a real implementation, you'd create the chat first, then send the message
      const tempChatId = `temp_${Date.now()}`;
      
      await sendMessage({
        chatId: tempChatId,
        messageData: {
          content: values.message,
          subject: values.subject,
          recipientType: values.recipientType,
          recipientId: values.recipientId,
        },
      }).unwrap();

      message.success(t('newChatCreatedSuccessfully', { ns: 'client-portal-chats' }) || 'Chat created successfully!');
      form.resetFields();
      onClose();
      onSuccess?.(tempChatId);
    } catch (error) {
      console.error('Failed to create new chat:', error);
      message.error(t('newChatFailed', { ns: 'client-portal-chats' }) || 'Failed to create chat. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const clients = clientsData?.body?.clients || [];

  return (
    <Modal
      title={
        <Space>
          <MessageOutlined />
          <Typography.Text strong>
            {t('newChat', { ns: 'client-portal-chats' }) || 'New Chat'}
          </Typography.Text>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnClose
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          recipientType: 'client',
        }}
        style={{ marginTop: 24 }}
      >
        <Form.Item
          name="recipientType"
          label={t('recipientType', { ns: 'client-portal-chats' }) || 'Message To'}
          rules={[{ required: true, message: t('recipientTypeRequired', { ns: 'common' }) || 'Please select recipient type' }]}
        >
          <Select placeholder={t('selectRecipientType', { ns: 'client-portal-chats' }) || 'Select who to message'}>
            <Option value="client">{t('client', { ns: 'common' }) || 'Client'}</Option>
            <Option value="team">{t('teamMember', { ns: 'common' }) || 'Team Member'}</Option>
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => 
            prevValues.recipientType !== currentValues.recipientType
          }
        >
          {({ getFieldValue }) => {
            const recipientType = getFieldValue('recipientType');
            
            return (
              <Form.Item
                name="recipientId"
                label={
                  recipientType === 'client' 
                    ? (t('selectClient', { ns: 'client-portal-chats' }) || 'Select Client')
                    : (t('selectTeamMember', { ns: 'client-portal-chats' }) || 'Select Team Member')
                }
                rules={[{ required: true, message: t('recipientRequired', { ns: 'common' }) || 'Please select a recipient' }]}
              >
                <Select
                  placeholder={
                    recipientType === 'client' 
                      ? (t('chooseClient', { ns: 'client-portal-chats' }) || 'Choose a client')
                      : (t('chooseTeamMember', { ns: 'client-portal-chats' }) || 'Choose a team member')
                  }
                  loading={isLoadingClients}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {recipientType === 'client' ? (
                    clients.map((client: any) => (
                      <Option key={client.id} value={client.id}>
                        {client.name} {client.company_name && `(${client.company_name})`}
                      </Option>
                    ))
                  ) : (
                    // For team members, you'd need to fetch team members from API
                    // For now, showing a placeholder
                    <Option value="team-placeholder" disabled>
                      {t('teamMembersNotAvailable', { ns: 'client-portal-chats' }) || 'Team members list not available'}
                    </Option>
                  )}
                </Select>
              </Form.Item>
            );
          }}
        </Form.Item>

        <Form.Item
          name="subject"
          label={t('subject', { ns: 'client-portal-chats' }) || 'Subject'}
          rules={[
            { required: true, message: t('subjectRequired', { ns: 'common' }) || 'Please enter a subject' },
            { min: 3, message: t('subjectTooShort', { ns: 'common' }) || 'Subject must be at least 3 characters' },
            { max: 100, message: t('subjectTooLong', { ns: 'common' }) || 'Subject must be less than 100 characters' },
          ]}
        >
          <Input
            placeholder={t('subjectPlaceholder', { ns: 'client-portal-chats' }) || 'Enter chat subject'}
            maxLength={100}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="message"
          label={t('message', { ns: 'client-portal-chats' }) || 'Initial Message'}
          rules={[
            { required: true, message: t('messageRequired', { ns: 'common' }) || 'Please enter a message' },
            { min: 10, message: t('messageTooShort', { ns: 'common' }) || 'Message must be at least 10 characters' },
            { max: 1000, message: t('messageTooLong', { ns: 'common' }) || 'Message must be less than 1000 characters' },
          ]}
        >
          <TextArea
            placeholder={t('messagePlaceholder', { ns: 'client-portal-chats' }) || 'Type your message here...'}
            rows={4}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel} disabled={isSubmitting}>
              {t('cancel', { ns: 'common' }) || 'Cancel'}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              icon={<MessageOutlined />}
            >
              {t('sendMessage', { ns: 'client-portal-chats' }) || 'Send Message'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default NewChatModal;