import React, { useState, useEffect } from 'react';
import { Drawer, Select, Button, message, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import apiClient from '@/api/api-client';

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
          setManagers(response.body.data?.filter(m => m.id !== member?.id) || []);
        }
        setLoading(false);
      });
    }
  }, [open, member]);

  const handleAssignManager = async () => {
    if (!member || !selectedManager) return;

    try {
      await apiClient.post('/api/team-management/assign-manager', {
        teamMemberId: member.id,
        managerId: selectedManager,
      });
      message.success(t('manager_assigned_successfully'));
      onManagerAssigned();
      onClose();
    } catch (error) {
      message.error(t('failed_to_assign_manager'));
    }
  };

  return (
    <Drawer
      title={t('assign_manager')}
      placement="right"
      onClose={onClose}
      open={open}
      width={400}
    >
      {loading ? (
        <Spin />
      ) : (
        <div>
          <p>{t('assign_manager_for', { name: member?.name })}</p>
          <Select
            style={{ width: '100%' }}
            placeholder={t('select_a_manager')}
            onChange={setSelectedManager}
            value={selectedManager}
          >
            {managers.map(manager => (
              <Select.Option key={manager.id} value={manager.id}>
                {manager.name}
              </Select.Option>
            ))}
          </Select>
          <Button
            type="primary"
            style={{ marginTop: '1rem' }}
            onClick={handleAssignManager}
            disabled={!selectedManager}
          >
            {t('assign')}
          </Button>
        </div>
      )}
    </Drawer>
  );
};
