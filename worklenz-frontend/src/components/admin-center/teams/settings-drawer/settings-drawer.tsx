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
} from 'antd';
import React, { useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleSettingDrawer, updateTeam } from '@/features/teams/teamSlice';
import { TeamsType } from '@/types/admin-center/team.types';
import './settings-drawer.css';
import CustomAvatar from '@/components/CustomAvatar';
import { teamsApiService } from '@/api/teams/teams.api.service';
import logger from '@/utils/errorLogger';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  IOrganizationTeam,
  IOrganizationTeamMember,
} from '@/types/admin-center/admin-center.types';
import Avatars from '@/components/avatars/avatars';
import { AvatarNamesMap } from '@/shared/constants';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useTranslation } from 'react-i18next';

interface SettingTeamDrawerProps {
  teamId: string;
  isSettingDrawerOpen: boolean;
  setIsSettingDrawerOpen: (value: boolean) => void;
}

const SettingTeamDrawer: React.FC<SettingTeamDrawerProps> = ({
  teamId,
  isSettingDrawerOpen,
  setIsSettingDrawerOpen,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('admin-center/teams');
  const [form] = Form.useForm();
  const [teamData, setTeamData] = useState<IOrganizationTeam | null>(null);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [updatingTeam, setUpdatingTeam] = useState(false);

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
    console.log(values);
    // const newTeam: TeamsType = {
    //   teamId: teamId,
    //   teamName: values.name,
    //   membersCount: team?.membersCount || 1,
    //   members: team?.members || ['Raveesha Dilanka'],
    //   owner: values.name,
    //   created: team?.created || new Date(),
    //   isActive: false,
    // };
    // dispatch(updateTeam(newTeam));
    // dispatch(toggleSettingDrawer());
    // form.resetFields();
    // message.success('Team updated!');
  };

  const roleOptions = [
    { value: 'Admin', label: t('admin') },
    { value: 'Member', label: t('member') },
    { value: 'Owner', label: t('owner') },
  ];

  const columns: TableProps['columns'] = [
    {
      title: t('user'),
      key: 'user',
      render: (_, record: IOrganizationTeamMember) => (
        <Flex align="center" gap="8px" key={record.id}>
          <SingleAvatar avatarUrl={record.avatar_url} name={record.name} />
          <Typography.Text>{record.name || ''}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: t('role'),
      key: 'role',
      render: (_, record: IOrganizationTeamMember) => (
        <div>
          <Select
            style={{ width: '150px', height: '32px' }}
            options={roleOptions.map(option => ({ ...option, key: option.value }))}
            defaultValue={record.role_name || ''}
            disabled={record.role_name === 'Owner'}
          />
        </div>
      ),
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
