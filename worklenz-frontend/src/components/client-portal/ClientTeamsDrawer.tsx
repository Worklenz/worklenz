import {
  Button,
  Drawer,
  Flex,
  Input,
  message,
  Popconfirm,
  Table,
  Tooltip,
  Typography,
  Form,
  Select,
  Spin,
  Avatar,
  Tag,
  List,
  Empty,
} from 'antd';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import {
  toggleClientTeamsDrawer,
} from '../../features/clients-portal/clients/clients-slice';
import {
  CopyOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  UserAddOutlined,
  MailOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { TableProps } from 'antd/lib';
import { colors } from '../../styles/colors';
import { 
  useGetClientDetailsQuery,
  useGetClientTeamQuery,
  useInviteTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useResendTeamInvitationMutation,
} from '../../api/client-portal/client-portal-api';
import { useState } from 'react';

const { Option } = Select;

const ClientTeamsDrawer = () => {
  const { t } = useTranslation('client-portal-clients');

  const {
    isClientTeamsDrawerOpen,
    selectedClientId,
  } = useAppSelector((state) => state.clientsPortalReducer.clientsReducer);
  
  const dispatch = useAppDispatch();

  // Local state
  const [inviteForm] = Form.useForm();
  const [isInviting, setIsInviting] = useState(false);

  // RTK Query hooks - only load data when drawer is open
  const { 
    data: clientDetails, 
    isLoading: isLoadingClient 
  } = useGetClientDetailsQuery(selectedClientId!, { 
    skip: !selectedClientId
  });

  // Extract data from comprehensive response
  const client = clientDetails?.body;
  const clientTeam = client ? { team_members: client.team_members } : null;

  const { 
    refetch: refetchTeam
  } = useGetClientTeamQuery({ 
    clientId: selectedClientId! 
  }, { 
    skip: !selectedClientId || !isClientTeamsDrawerOpen 
  });

  const isLoadingTeam = isLoadingClient;

  const [inviteTeamMember, { isLoading: isInvitingMember }] = useInviteTeamMemberMutation();
  const [removeTeamMember, { isLoading: isRemovingMember }] = useRemoveTeamMemberMutation();
  const [resendInvitation, { isLoading: isResending }] = useResendTeamInvitationMutation();

  // function to copy link to clipboard
  const copyLinkToClipboard = () => {
    const link = `https://app.worklenz.com/client-portal/${selectedClientId}`;
    navigator.clipboard.writeText(link);
    message.success(t('linkCopiedMessage') || 'Link copied to clipboard');
  };

  // Handle invite team member
  const handleInviteTeamMember = async (values: any) => {
    if (!selectedClientId) return;

    try {
      setIsInviting(true);
      await inviteTeamMember({
        clientId: selectedClientId,
        memberData: {
          email: values.email,
          name: values.name,
          role: values.role,
        }
      }).unwrap();
      
      message.success(t('inviteSuccessMessage') || 'Team member invited successfully');
      inviteForm.resetFields();
      refetchTeam();
    } catch (error: any) {
      message.error(error?.data?.message || t('inviteErrorMessage') || 'Failed to invite team member');
    } finally {
      setIsInviting(false);
    }
  };

  // Handle remove team member
  const handleRemoveTeamMember = async (memberId: string) => {
    if (!selectedClientId) return;

    try {
      await removeTeamMember({
        clientId: selectedClientId,
        memberId
      }).unwrap();
      
      message.success(t('removeMemberSuccessMessage') || 'Team member removed successfully');
      refetchTeam();
    } catch (error: any) {
      message.error(t('removeMemberErrorMessage') || 'Failed to remove team member');
    }
  };

  // Handle resend invitation
  const handleResendInvitation = async (memberId: string) => {
    if (!selectedClientId) return;

    try {
      await resendInvitation({
        clientId: selectedClientId,
        memberId
      }).unwrap();
      
      message.success(t('resendInvitationSuccessMessage') || 'Invitation resent successfully');
    } catch (error: any) {
      message.error(t('resendInvitationErrorMessage') || 'Failed to resend invitation');
    }
  };

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('nameColumn') || 'Name',
      render: (_, record: any) => (
        <Flex gap={8} align="center">
          <Avatar icon={<MailOutlined />} size={26} />
          <div>
            <Typography.Text style={{ textTransform: 'capitalize', display: 'block' }}>
              {record.name}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              {record.email}
            </Typography.Text>
          </div>
        </Flex>
      ),
    },
    {
      key: 'role',
      title: t('roleColumn') || 'Role',
      render: (_, record: any) => (
        <Tag color="blue">{record.role || t('noRole') || 'No Role'}</Tag>
      ),
      width: 120,
    },
    {
      key: 'status',
      title: t('statusColumn') || 'Status',
      render: (_, record: any) => (
        <Tag color={record.status === 'active' ? 'green' : 'orange'}>
          {record.status}
        </Tag>
      ),
      width: 100,
    },
    {
      key: 'actionBtns',
      title: t('actionBtnsColumn') || 'Actions',
      width: 150,
      render: (_, record: any) => (
        <Flex gap={8} align="center">
          {!record.accepted_at && (
            <Tooltip title={t('resendInvitationTooltip') || 'Resend Invitation'}>
              <Button
                shape="default"
                icon={<ReloadOutlined />}
                size="small"
                loading={isResending}
                onClick={() => handleResendInvitation(record.id)}
              />
            </Tooltip>
          )}
          
          <Popconfirm
            title={t('removeMemberConfirmationTitle') || 'Remove Team Member'}
            description={t('removeMemberConfirmationDescription') || 'Are you sure you want to remove this team member?'}
            icon={
              <ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />
            }
            okText={t('removeConfirmationOk') || 'Remove'}
            cancelText={t('removeConfirmationCancel') || 'Cancel'}
            onConfirm={() => handleRemoveTeamMember(record.id)}
          >
            <Tooltip title={t('removeMemberTooltip') || 'Remove Member'}>
              <Button 
                shape="default" 
                icon={<DeleteOutlined />} 
                size="small"
                danger
                loading={isRemovingMember}
              />
            </Tooltip>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  if (!selectedClientId) {
    return null;
  }

  return (
    <Drawer
      title={
        <Flex align="center" gap={8}>
          <Typography.Title level={2} style={{ margin: 0, textTransform: 'capitalize' }}>
            {client?.name || t('loadingText') || 'Loading...'}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('teamManagementTitle') || 'Team Management'}
          </Typography.Text>
        </Flex>
      }
      open={isClientTeamsDrawerOpen}
      onClose={() => dispatch(toggleClientTeamsDrawer(null))}
      width={800}
    >
      <Spin spinning={isLoadingClient || isLoadingTeam}>
        <Flex vertical gap={32}>
          {/* Client Portal Link */}
          <Flex vertical gap={8}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('clientPortalLinkLabel') || 'Client Portal Link'}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('clientPortalLinkDescription') || 'Share this link with your client to give them access to their portal'}
            </Typography.Text>
            <Flex gap={8} align="center">
              <Input
                value={`https://app.worklenz.com/client-portal/${selectedClientId}`}
                readOnly
                style={{ flex: 1 }}
              />
              <Button
                type="default"
                icon={<CopyOutlined />}
                onClick={copyLinkToClipboard}
              >
                {t('copyButton') || 'Copy'}
              </Button>
            </Flex>
          </Flex>

          {/* Invite Team Member */}
          <Flex vertical gap={8}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('inviteTeamMemberLabel') || 'Invite Team Member'}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('inviteTeamMemberDescription') || 'Send an invitation to add a new team member to this client'}
            </Typography.Text>
            <Form
              form={inviteForm}
              layout="vertical"
              onFinish={handleInviteTeamMember}
              autoComplete="off"
            >
              <Flex gap={16} align="flex-end">
                <Form.Item
                  name="name"
                  label={t('nameLabel') || 'Name'}
                  rules={[
                    { required: true, message: t('nameRequired') || 'Please enter name' }
                  ]}
                  style={{ flex: 1 }}
                >
                  <Input 
                    placeholder={t('namePlaceholder') || 'Enter full name'} 
                    size="middle"
                  />
                </Form.Item>

                <Form.Item
                  name="email"
                  label={t('emailLabel') || 'Email'}
                  rules={[
                    { required: true, message: t('emailRequired') || 'Please enter email' },
                    { type: 'email', message: t('emailInvalid') || 'Please enter a valid email' }
                  ]}
                  style={{ flex: 1 }}
                >
                  <Input 
                    placeholder={t('emailPlaceholder') || 'Enter email address'} 
                    size="middle"
                  />
                </Form.Item>

                <Form.Item
                  name="role"
                  label={t('roleLabel') || 'Role'}
                  style={{ width: 150 }}
                >
                  <Select placeholder={t('rolePlaceholder') || 'Select role'} size="middle">
                    <Option value="admin">{t('roleAdmin') || 'Admin'}</Option>
                    <Option value="member">{t('roleMember') || 'Member'}</Option>
                    <Option value="viewer">{t('roleViewer') || 'Viewer'}</Option>
                  </Select>
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    htmlType="submit"
                    loading={isInvitingMember}
                    size="middle"
                  >
                    {t('inviteButton') || 'Invite'}
                  </Button>
                </Form.Item>
              </Flex>
            </Form>
          </Flex>

          {/* Team Members List */}
          <Flex vertical gap={8}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('teamMembersLabel') || 'Team Members'}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('teamMembersDescription') || 'Manage team members who have access to this client'}
            </Typography.Text>
            {clientTeam?.team_members && clientTeam.team_members.length > 0 ? (
              <Table
                dataSource={clientTeam.team_members}
                columns={columns}
                pagination={false}
                size="small"
                rowKey="id"
              />
            ) : (
              <Empty 
                description={t('noTeamMembersText') || 'No team members found'} 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
              />
            )}
          </Flex>
        </Flex>
      </Spin>
    </Drawer>
  );
};

export default ClientTeamsDrawer;
  