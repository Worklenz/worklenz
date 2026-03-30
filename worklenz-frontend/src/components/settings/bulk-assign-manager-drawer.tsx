import React, { useState, useEffect } from 'react';
import { Drawer, Select, Button, message, Spin, List, Avatar, Typography, Flex, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { teamManagementApiService } from '@/api/team-management/team-management.api.service';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
// import { colors } from '@/styles/colors';
import { getRoleColor } from '@/types/roles/role.types';
import { UsergroupAddOutlined, UserOutlined } from '@/shared/antd-imports';

interface BulkAssignManagerDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedMembers: ITeamMemberViewModel[];
  onAssignmentComplete: () => void;
}

export const BulkAssignManagerDrawer: React.FC<BulkAssignManagerDrawerProps> = ({
  open,
  onClose,
  selectedMembers,
  onAssignmentComplete,
}) => {
  const { t } = useTranslation('settings/team-members');
  const [teamLeads, setTeamLeads] = useState<ITeamMemberViewModel[]>([]);
  const [selectedTeamLead, setSelectedTeamLead] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (open && selectedMembers.length > 0) {
      loadTeamLeads();
    }
  }, [open, selectedMembers]);

  const loadTeamLeads = async () => {
    setLoading(true);
    try {
      const response = await teamMembersApiService.get(1, 1000, 'name', 'asc', '', true);
      if (response.done && response.body.data) {
        // Filter for Team Leads and exclude selected members
        const selectedMemberIds = selectedMembers.map(m => m.id);
        const availableTeamLeads = response.body.data.filter(
          member => member.role_name === 'Team Lead' && !selectedMemberIds.includes(member.id)
        );
        setTeamLeads(availableTeamLeads);
      }
    } catch (error) {
      message.error(t('failed_to_load_team_leads'));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedTeamLead || selectedMembers.length === 0) {
      message.warning(t('please_select_team_lead_and_members'));
      return;
    }

    setAssigning(true);
    try {
      const memberIds = selectedMembers.map(member => member.id).filter(Boolean);

      await teamManagementApiService.bulkAssignMembers(selectedTeamLead, memberIds);

      message.success(
        t('bulk_assignment_success', {
          count: selectedMembers.length,
          teamLeadName: teamLeads.find(tl => tl.id === selectedTeamLead)?.name,
        })
      );

      onAssignmentComplete();
      onClose();
      setSelectedTeamLead(null);
    } catch (error) {
      message.error(t('bulk_assignment_failed'));
    } finally {
      setAssigning(false);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedTeamLead(null);
  };

  const selectedTeamLeadData = teamLeads.find(tl => tl.id === selectedTeamLead);

  return (
    <Drawer
      title={
        <Flex align="center" gap={8}>
          <UsergroupAddOutlined />
          {t('bulk_assign_manager')}
        </Flex>
      }
      placement="right"
      onClose={handleClose}
      open={open}
      width={500}
      footer={
        <Flex justify="space-between">
          <Button onClick={handleClose}>{t('cancelText')}</Button>
          <Button
            type="primary"
            onClick={handleBulkAssign}
            disabled={!selectedTeamLead || selectedMembers.length === 0}
            loading={assigning}
          >
            {t('assign_to_team_lead', { count: selectedMembers.length })}
          </Button>
        </Flex>
      }
    >
      {loading ? (
        <Flex justify="center" style={{ padding: '2rem' }}>
          <Spin size="large" />
        </Flex>
      ) : (
        <div>
          {/* Selected Members Summary */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Typography.Title level={5}>
              {t('selected_members')} ({selectedMembers.length})
            </Typography.Title>
            <List
              size="small"
              dataSource={selectedMembers}
              renderItem={member => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={32}
                        src={member.avatar_url}
                        style={{ backgroundColor: member.color_code }}
                      >
                        {member.name?.charAt(0)}
                      </Avatar>
                    }
                    title={
                      <Flex gap={8} align="center">
                        <span>{member.name}</span>
                        <Tag color={getRoleColor(member.role_name)} style={{ margin: 0 }}>
                          {member.role_name}
                        </Tag>
                      </Flex>
                    }
                    description={member.email}
                  />
                </List.Item>
              )}
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: `1px solid #d9d9d9`,
                borderRadius: '6px',
                padding: '8px',
              }}
            />
          </div>

          {/* Team Lead Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Typography.Title level={5}>{t('select_team_lead')}</Typography.Title>
            <Select
              style={{ width: '100%' }}
              placeholder={t('select_team_lead_placeholder')}
              onChange={setSelectedTeamLead}
              value={selectedTeamLead}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={teamLeads.map(teamLead => ({
                value: teamLead.id,
                label: teamLead.name,
                disabled: false,
              }))}
              notFoundContent={
                teamLeads.length === 0 ? t('no_team_leads_available') : t('no_matching_team_leads')
              }
            />
          </div>

          {/* Assignment Preview */}
          {selectedTeamLeadData && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '6px',
                border: `1px solid #d9d9d9`,
              }}
            >
              <Typography.Title level={5} style={{ margin: 0, marginBottom: '0.5rem' }}>
                {t('assignment_preview')}
              </Typography.Title>
              <Flex align="center" gap={12}>
                <Avatar
                  size={40}
                  src={selectedTeamLeadData.avatar_url}
                  style={{ backgroundColor: selectedTeamLeadData.color_code }}
                >
                  {selectedTeamLeadData.name?.charAt(0)}
                </Avatar>
                <div>
                  <Typography.Text strong>{selectedTeamLeadData.name}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">
                    {t('will_manage_members', { count: selectedMembers.length })}
                  </Typography.Text>
                </div>
              </Flex>
            </div>
          )}

          {teamLeads.length === 0 && !loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#666',
              }}
            >
              <UserOutlined style={{ fontSize: '2rem', marginBottom: '1rem' }} />
              <Typography.Paragraph>{t('no_team_leads_found')}</Typography.Paragraph>
              <Typography.Paragraph type="secondary">
                {t('create_team_leads_first')}
              </Typography.Paragraph>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};
