import React, { useState, useEffect } from 'react';
import { Drawer, Select, Button, message, Spin, Alert, Typography, Flex, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { teamManagementApiService } from '@/api/team-management/team-management.api.service';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

interface AssignManagerDrawerProps {
  open: boolean;
  onClose: () => void;
  member: ITeamMemberViewModel | null;
  onManagerAssigned: () => void;
}

export const AssignManagerDrawer: React.FC<AssignManagerDrawerProps> = ({
  open,
  onClose,
  member,
  onManagerAssigned,
}) => {
  const { t } = useTranslation('settings/team-members');
  const [managers, setManagers] = useState<ITeamMemberViewModel[]>([]);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      teamMembersApiService.get(1, 1000, 'name', 'asc', '', true).then(response => {
        if (response.done) {
          // Filter for Team Leads only and exclude the member being assigned
          const teamLeads =
            response.body.data?.filter(m => m.id !== member?.id && m.role_name === 'Team Lead') ||
            [];
          setManagers(teamLeads);
        }
        setLoading(false);
      });
    }
  }, [open, member]);

  const handleAssignManager = async () => {
    if (!member || !selectedManager) return;

    try {
      const response = await teamManagementApiService.assignManager(member.id!, selectedManager);
      if (response.done) {
        onManagerAssigned();
        onClose();
        setSelectedManager(null);
      } else {
        message.error(response.message || t('failed_to_assign_manager'));
      }
    } catch (error: any) {
      console.error('Error assigning manager:', error);
      message.error(error.response?.data?.message || t('failed_to_assign_manager'));
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedManager(null);
  };

  return (
    <Drawer
      title={
        <Flex align="center" gap={8}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('assign_team_lead')}
          </Typography.Title>
        </Flex>
      }
      placement="right"
      onClose={handleClose}
      open={open}
      width={450}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <div style={{ padding: '16px 0' }}>
          <Typography.Paragraph>
            <Typography.Text strong>{t('assign_team_lead_for')}: </Typography.Text>
            <Typography.Text>{member?.name}</Typography.Text>
          </Typography.Paragraph>

          {/* Current Assignment */}
          {member?.reports_to_member_id && member?.current_team_lead_name && (
            <Alert
              message={t('current_assignment')}
              description={
                <Flex align="center" gap={8} style={{ marginTop: 8 }}>
                  <Tag color="blue">{member.current_team_lead_name}</Tag>
                  <Typography.Text type="secondary">{t('currently_assigned_to')}</Typography.Text>
                </Flex>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('select_team_lead')}:
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              placeholder={t('select_a_team_lead')}
              onChange={setSelectedManager}
              value={selectedManager}
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {managers.map(manager => (
                <Select.Option key={manager.id} value={manager.id}>
                  {manager.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {managers.length === 0 && (
            <Alert
              message={t('no_team_leads_available')}
              description={t('no_team_leads_description')}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Flex gap={8} style={{ marginTop: 24 }}>
            <Button
              type="primary"
              onClick={handleAssignManager}
              disabled={!selectedManager || managers.length === 0}
              style={{ flex: 1 }}
            >
              {t('assign_team_lead')}
            </Button>
            <Button onClick={handleClose} style={{ flex: 1 }}>
              {t('cancel')}
            </Button>
          </Flex>
        </div>
      )}
    </Drawer>
  );
};
