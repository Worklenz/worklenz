import { Button, Flex, Input, message, Modal, Select, Space, Typography, List, Avatar } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  toggleInviteMemberDrawer,
  triggerTeamMembersRefresh,
} from '../../../features/settings/member/memberSlice';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import { DeleteOutlined, UserOutlined } from '@ant-design/icons';

interface MemberEntry {
  email: string;
  access: 'member' | 'admin' | 'guest';
}


const InviteTeamMembersModal = () => {
  const [newMembers, setNewMembers] = useState<MemberEntry[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);

  const { t } = useTranslation('settings/team-members');
  const isModalOpen = useAppSelector(state => state.memberReducer.isInviteMemberDrawerOpen);
  const dispatch = useAppDispatch();


  useEffect(() => {
    if (isModalOpen) {
      // Reset state when modal opens
      setNewMembers([]);
      setEmailInput('');
      // Focus on email input when modal opens
      setTimeout(() => {
        const emailInput = document.querySelector('input[type="text"]');
        if (emailInput) {
          (emailInput as HTMLElement).focus();
        }
      }, 100);
    }
  }, [isModalOpen]);

  const handleFormSubmit = async () => {
    try {
      setLoading(true);
      
      if (newMembers.length === 0) {
        message.error('Please add at least one member');
        return;
      }

      // Send invitations for each member
      const promises = newMembers.map(member => {
        const body: ITeamMemberCreateRequest = {
          emails: [member.email],
          is_admin: member.access === 'admin',
          is_guest: member.access === 'guest',
        };
        return teamMembersApiService.createTeamMember(body);
      });

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      if (successful > 0) {
        message.success(`${successful} invitation(s) sent successfully`);
        setNewMembers([]);
        setEmailInput('');
        dispatch(triggerTeamMembersRefresh());
        dispatch(toggleInviteMemberDrawer());
      }
      
      const failed = results.length - successful;
      if (failed > 0) {
        message.error(`${failed} invitation(s) failed`);
      }
    } catch (error) {
      message.error(t('createMemberErrorMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewMembers([]);
    setEmailInput('');
    dispatch(toggleInviteMemberDrawer());
  };

  const handleEmailKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const trimmedEmail = emailInput.trim();
      
      // Don't show error for empty input, just ignore
      if (!trimmedEmail) {
        return;
      }
      
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!emailPattern.test(trimmedEmail)) {
        message.error('Please enter a valid email address');
        return;
      }

      // Check if email already exists
      if (newMembers.find(m => m.email === trimmedEmail)) {
        message.warning('Email already added');
        return;
      }

      // Add new member
      setNewMembers([...newMembers, { email: trimmedEmail, access: 'member' }]);
      setEmailInput('');
    }
  };

  const updateMemberAccess = (index: number, access: 'member' | 'admin' | 'guest') => {
    const updated = [...newMembers];
    updated[index].access = access;
    setNewMembers(updated);
  };

  const removeMember = (index: number) => {
    setNewMembers(newMembers.filter((_, i) => i !== index));
  };




  const accessOptions = useMemo(() => [
    { value: 'member', label: t('memberText') },
    { value: 'admin', label: t('adminText') },
    { value: 'guest', label: t('guestText') },
  ], [t]);

  const renderContent = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Enter email address and press Enter to add"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyPress={handleEmailKeyPress}
          size="middle"
          autoFocus
          style={{
            borderRadius: 8,
            fontSize: 14
          }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block', fontStyle: 'italic' }}>
          Press Enter to add • Multiple emails can be added
        </Typography.Text>
      </div>

      {newMembers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13, marginBottom: 12, display: 'block', fontWeight: 500 }}>
            Members to invite ({newMembers.length})
          </Typography.Text>
          <div style={{
            background: 'rgba(0, 0, 0, 0.02)',
            borderRadius: 8,
            padding: '8px 12px',
            border: '1px solid rgba(0, 0, 0, 0.06)'
          }}>
            <List
              size="small"
              dataSource={newMembers}
              split={false}
              renderItem={(member, index) => (
                <List.Item
                  style={{ 
                    padding: '8px 0',
                    borderRadius: 6,
                    marginBottom: index < newMembers.length - 1 ? 4 : 0
                  }}
                  actions={[
                    <Select
                      size="small"
                      value={member.access}
                      onChange={(value) => updateMemberAccess(index, value)}
                      options={accessOptions}
                      style={{ width: 90 }}
                      variant="outlined"
                    />,
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removeMember(index)}
                      size="small"
                      danger
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    />
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar size={32} style={{ 
                        backgroundColor: '#1677ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <UserOutlined style={{ fontSize: 14 }} />
                      </Avatar>
                    }
                    title={
                      <span style={{ 
                        fontSize: 14, 
                        fontWeight: 500,
                        color: 'rgba(0, 0, 0, 0.88)'
                      }}>
                        {member.email}
                      </span>
                    }
                    description={
                      <span style={{ 
                        fontSize: 12, 
                        color: '#52c41a',
                        fontWeight: 500
                      }}>
                        Ready to invite
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );


  return (
    <Modal
      title={
        <Typography.Text strong style={{ fontSize: 18 }}>
          {t('inviteTeamMembersModalTitle')}
        </Typography.Text>
      }
      open={isModalOpen}
      onCancel={handleClose}
      width={520}
      destroyOnClose
      bodyStyle={{ padding: '16px 20px' }}
      footer={
        <Flex justify="end">
          <Space>
            <Button onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={handleFormSubmit}
              loading={loading}
              disabled={newMembers.length === 0}
            >
              Send
            </Button>
          </Space>
        </Flex>
      }
    >
      {renderContent()}
    </Modal>
  );
};

export default memo(InviteTeamMembersModal);