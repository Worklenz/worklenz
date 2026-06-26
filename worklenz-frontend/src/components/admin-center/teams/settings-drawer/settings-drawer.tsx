import {
  Avatar,
  Button,
  Drawer,
  Flex,
  Form,
  Input,
  message,
  Select,
  Table,
  TableProps,
  Typography,
  Tooltip,
} from '@/shared/antd-imports';
import React, { useState, useRef } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import './settings-drawer.css';
import logger from '@/utils/errorLogger';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  IOrganizationTeam,
  IOrganizationTeamMember,
} from '@/types/admin-center/admin-center.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useTranslation } from 'react-i18next';

interface SettingTeamDrawerProps {
  teamId: string;
  isSettingDrawerOpen: boolean;
  setIsSettingDrawerOpen: (value: boolean) => void;
  reloadTeams?: () => void;
}

const SettingTeamDrawer: React.FC<SettingTeamDrawerProps> = ({
  teamId,
  isSettingDrawerOpen,
  setIsSettingDrawerOpen,
  reloadTeams,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('admin-center/teams');
  const [form] = Form.useForm();
  const [teamData, setTeamData] = useState<IOrganizationTeam | null>(null);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [updatingTeam, setUpdatingTeam] = useState(false);

  // Tracks which member's name is currently being edited (by member id)
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  // Tracks the current value of the name input while editing
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  // Ref to prevent the blur handler from firing after Enter/Escape
  const committingRef = useRef(false);

  const [total, setTotal] = useState(0);

  const fetchTeamMembers = async () => {
    if (!teamId) return;
    try {
      setLoadingTeamMembers(true);
      const res = await adminCenterApiService.getOrganizationTeam(teamId);
      if (res.done) {
        setTeamData(res.body);
        setTotal(res.body.team_members?.length || 0);
        form.setFieldsValue({ name: res.body.name || '' });
      }
    } catch (error) {
      logger.error('Error fetching team members', error);
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  const handleFormSubmit = async (values: any) => {
    try {
      setUpdatingTeam(true);

      const body = {
        name: values.name,
        // Send updated member names along with the rest of team data
        teamMembers: teamData?.team_members || [],
      };

      const response = await adminCenterApiService.updateTeam(teamId, body);

      if (response.done) {
        setIsSettingDrawerOpen(false);
        if (reloadTeams) {
          setTimeout(() => {
            reloadTeams();
          }, 100);
        }
      }
    } catch (error) {
      logger.error('Error updating team', error);
    } finally {
      setUpdatingTeam(false);
    }
  };

  // ── Inline name editing helpers ──────────────────────────────────────────

  const startEditingName = (member: IOrganizationTeamMember) => {
    // Pending invitations have no real name to edit yet
    if (member.pending_invitation) return;
    setEditingNameId(member.id);
    setEditingNameValue(member.name || '');
  };

  const commitNameEdit = (memberId: string) => {
    committingRef.current = true;
    const trimmed = editingNameValue.trim();

    if (trimmed && teamData?.team_members) {
      setTeamData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          team_members: prev.team_members.map(m =>
            m.id === memberId ? { ...m, name: trimmed } : m
          ),
        };
      });
    }

    setEditingNameId(null);
    setEditingNameValue('');
    // Reset the guard after the current event cycle
    setTimeout(() => {
      committingRef.current = false;
    }, 0);
  };

  const cancelNameEdit = () => {
    committingRef.current = true;
    setEditingNameId(null);
    setEditingNameValue('');
    setTimeout(() => {
      committingRef.current = false;
    }, 0);
  };

  const handleNameBlur = (memberId: string) => {
    // Skip if blur was triggered by Enter/Escape handlers
    if (committingRef.current) return;
    commitNameEdit(memberId);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent, memberId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitNameEdit(memberId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelNameEdit();
    }
  };

  // ────────────────────────────────────────────────────────────────────────

  const roleOptions = [
    { key: 'Admin', value: 'Admin', label: t('admin') },
    { key: 'Member', value: 'Member', label: t('member') },
    { key: 'Owner', value: 'Owner', label: t('owner'), disabled: true },
  ];

  const columns: TableProps['columns'] = [
    {
      title: t('user'),
      key: 'user',
      render: (_, record: IOrganizationTeamMember) => {
        const isPending = record.pending_invitation;
        const isEditing = editingNameId === record.id;

        return (
          <Flex align="center" gap="8px" key={record.id}>
            <SingleAvatar avatarUrl={record.avatar_url} name={record.name} />

            {isEditing ? (
              <Input
                autoFocus
                size="small"
                value={editingNameValue}
                style={{ width: 160 }}
                onChange={e => setEditingNameValue(e.target.value)}
                onBlur={() => handleNameBlur(record.id)}
                onKeyDown={e => handleNameKeyDown(e, record.id)}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <Tooltip
                title={
                  isPending
                    ? t('pendingInvitation')
                    : t('clickToEditName', { defaultValue: 'Click to edit name' })
                }
              >
                <Typography.Text
                  style={{
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    borderBottom: isPending ? 'none' : '1px dashed #d9d9d9',
                    paddingBottom: 1,
                  }}
                  onClick={() => !isPending && startEditingName(record)}
                >
                  {record.name || ''}
                </Typography.Text>
              </Tooltip>
            )}
          </Flex>
        );
      },
    },
    {
      title: t('role'),
      key: 'role',
      render: (_, record: IOrganizationTeamMember) => {
        const handleRoleChange = (value: string) => {
          if (value === 'Owner') return;

          if (teamData && teamData.team_members) {
            const updatedMembers = teamData.team_members.map(member => {
              if (member.id === record.id) {
                return { ...member, role_name: value };
              }
              return member;
            });

            setTeamData({
              ...teamData,
              team_members: updatedMembers,
            });
          }
        };

        const isDisabled = record.role_name === 'Owner' || record.pending_invitation;
        const tooltipTitle =
          record.role_name === 'Owner'
            ? t('cannotChangeOwnerRole')
            : record.pending_invitation
              ? t('pendingInvitation')
              : '';

        const selectComponent = (
          <Select
            style={{ width: '150px', height: '32px' }}
            options={roleOptions}
            defaultValue={record.role_name || ''}
            disabled={isDisabled}
            onChange={handleRoleChange}
          />
        );

        return (
          <div>
            {isDisabled ? (
              <Tooltip title={tooltipTitle}>{selectComponent}</Tooltip>
            ) : (
              selectComponent
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {t('teamSettings')}
        </Typography.Text>
      }
      width={550}
      open={isSettingDrawerOpen}
      onClose={() => {
        form.resetFields();
        setTeamData(null);
        setEditingNameId(null);
        setEditingNameValue('');
        setTimeout(() => {
          setIsSettingDrawerOpen(false);
        }, 100);
      }}
      destroyOnClose
      afterOpenChange={open => {
        if (open) {
          form.resetFields();
          setTeamData(null);
          fetchTeamMembers();
        }
      }}
      footer={
        <Flex justify="end">
          <Button type="primary" onClick={form.submit} loading={updatingTeam}>
            {t('update')}
          </Button>
        </Flex>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}
        initialValues={{
          name: teamData?.name,
        }}
      >
        <Form.Item
          name="name"
          key="name"
          label={t('teamName')}
          rules={[
            {
              required: true,
              message: t('message'),
            },
          ]}
        >
          <Input placeholder={t('teamNamePlaceholder')} />
        </Form.Item>

        <Form.Item
          name="users"
          label={
            <span>
              {t('members')} ({teamData?.team_members?.length})
            </span>
          }
        >
          <Table
            className="setting-team-table"
            style={{ marginBottom: '24px' }}
            columns={columns}
            dataSource={teamData?.team_members?.map(member => ({ ...member, key: member.id }))}
            pagination={false}
            loading={loadingTeamMembers}
            rowKey={record => record.team_member_id}
            size="small"
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default SettingTeamDrawer;