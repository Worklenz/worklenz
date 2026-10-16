import React, { useEffect, useState } from 'react';
import { Avatar, Button, Drawer, Flex, List, message, Select, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { departmentsApiService } from '@/api/settings/departments/departments.api.service';
import { practicesApiService } from '@/api/settings/practices/practices.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { IDepartment } from '@/types/department.types';
import { IPractice } from '@/types/practice.types';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';

type AssignmentType = 'department' | 'practice';

interface BulkAssignOrganizationDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedMembers: ITeamMemberViewModel[];
  assignmentType: AssignmentType;
  onAssignmentComplete: () => void;
}

export const BulkAssignOrganizationDrawer: React.FC<
  BulkAssignOrganizationDrawerProps
> = ({
  open,
  onClose,
  selectedMembers,
  assignmentType,
  onAssignmentComplete,
}) => {
  const { t } = useTranslation('settings/team-members');

  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const isDepartment = assignmentType === 'department';
  const title = isDepartment ? 'Assign Department' : 'Assign Practice';
  const optionLabel = isDepartment ? 'department' : 'practice';

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadOptions = async () => {
      setLoading(true);
      setSelectedId(undefined);

      try {
        if (isDepartment) {
          const response = await departmentsApiService.getDepartments(
            1, 1000, 'name', 'asc'
          );

          if (!response.done) {
            throw new Error('Failed to load departments');
          }

          const departments = (response.body.data ?? [])
            .filter((item: IDepartment): item is IDepartment & { id: string; name: string } =>
              Boolean(item.id && item.name)
            )
            .map(item => ({ id: item.id, name: item.name }));

          if (!cancelled) setOptions(departments);
        } else {
          const response = await practicesApiService.getPractices(
            1, 1000, 'name', 'asc'
          );

          if (!response.done) {
            throw new Error('Failed to load practices');
          }

          const practices = (response.body.data ?? [])
            .filter((item: IPractice): item is IPractice & { id: string; name: string } =>
              Boolean(item.id && item.name)
            )
            .map(item => ({ id: item.id, name: item.name }));

          if (!cancelled) setOptions(practices);
        }
      } catch {
        if (!cancelled) {
          message.error(`Failed to load ${optionLabel}s`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [open, isDepartment, optionLabel]);

  const handleClose = () => {
    setSelectedId(undefined);
    onClose();
  };

  const handleAssign = async () => {
    if (!selectedId || selectedMembers.length === 0) {
      message.warning(`Please select a ${optionLabel} and team members`);
      return;
    }

    setAssigning(true);

    try {
      for (const selectedMember of selectedMembers) {
        if (!selectedMember.id) {
          throw new Error('A selected team member has no ID');
        }

        // Fetch current values to avoid overwriting existing role/access data.
        const currentResponse = await teamMembersApiService.getById(
          selectedMember.id
        );

        if (!currentResponse.done || !currentResponse.body) {
          throw new Error(`Could not load ${selectedMember.name ?? 'member'}`);
        }

        const current = currentResponse.body;

        if (!current.role_name || current.is_admin === undefined) {
          throw new Error(
            `Could not verify the current role for ${selectedMember.name ?? 'member'}`
          );
        }

        const body: ITeamMemberCreateRequest = {
          job_title: current.job_title ?? null,
          department_id: isDepartment
            ? selectedId
            : current.department_id ?? null,
          practice_id: isDepartment
            ? current.practice_id ?? null
            : selectedId,
          emails: current.email ? [current.email] : [],
          role_name: current.role_name,
          is_admin: current.is_admin,
        };

        const updateResponse = await teamMembersApiService.update(
          selectedMember.id,
          body
        );

        if (!updateResponse.done) {
          throw new Error(
            `Failed to update ${selectedMember.name ?? 'a team member'}`
          );
        }
      }

      message.success(
        `${selectedMembers.length} team member(s) assigned to the selected ${optionLabel}`
      );

      setSelectedId(undefined);
      onAssignmentComplete();
      onClose();
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : `Failed to assign ${optionLabel}`
      );
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Drawer
      title={title}
      placement="right"
      width={500}
      open={open}
      onClose={handleClose}
      footer={
        <Flex justify="space-between">
          <Button onClick={handleClose} disabled={assigning}>
            {t('cancelText', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="primary"
            onClick={handleAssign}
            loading={assigning}
            disabled={!selectedId || selectedMembers.length === 0}
          >
            {title} ({selectedMembers.length})
          </Button>
        </Flex>
      }
    >
      <Typography.Title level={5}>
        Selected Members ({selectedMembers.length})
      </Typography.Title>

      <List
        size="small"
        dataSource={selectedMembers}
        renderItem={member => (
          <List.Item>
            <List.Item.Meta
              avatar={
                <Avatar src={member.avatar_url}>
                  {member.name?.charAt(0)}
                </Avatar>
              }
              title={member.name}
              description={member.email}
            />
          </List.Item>
        )}
        style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 24 }}
      />

      <Typography.Title level={5}>
        Select {optionLabel}
      </Typography.Title>

      {loading ? (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin />
        </Flex>
      ) : (
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={`Select a ${optionLabel}`}
          style={{ width: '100%' }}
          value={selectedId}
          onChange={setSelectedId}
          options={options.map(option => ({
            value: option.id,
            label: option.name,
          }))}
          notFoundContent={`No ${optionLabel}s found`}
        />
      )}
    </Drawer>
  );
};
