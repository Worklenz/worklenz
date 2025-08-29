import { Drawer, Flex, Form, Select, Typography, List, Button, Modal, Divider } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  addProjectMember,
  createByEmail,
  deleteProjectMember,
  getAllProjectMembers,
  toggleProjectMemberDrawer,
} from '@/features/projects/singleProject/members/projectMembersSlice';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { DeleteOutlined, MailOutlined } from '@/shared/antd-imports';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import logger from '@/utils/errorLogger';
import { validateEmail } from '@/utils/validateEmail';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';

const ProjectMemberDrawer = () => {
  const { t } = useTranslation('project-view/project-member-drawer');
  const { isDrawerOpen, currentMembersList, isLoading, isFromAssigner } = useAppSelector(
    state => state.projectMemberReducer
  );
  const { projectId } = useAppSelector(state => state.projectReducer);

  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const [searchTerm, setSearchTerm] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [members, setMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);

  // Filter out members already in the project
  const currentProjectMemberIds = (currentMembersList || [])
    .map(m => m.team_member_id)
    .filter(Boolean);
  const availableMembers = (members?.data || []).filter(
    member => member.id && !currentProjectMemberIds.includes(member.id)
  );

  const fetchProjectMembers = async () => {
    if (!projectId) return;
    dispatch(getAllProjectMembers(projectId));
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const fetchTeamMembers = async () => {
    if (!searchTerm.trim()) return;
    try {
      setTeamMembersLoading(true);
      const response = await teamMembersApiService.get(1, 10, null, null, searchTerm, true);
      if (response.done) {
        setMembers(response.body);
      }
    } catch (error) {
      logger.error('Error fetching team members:', error);
    } finally {
      setTeamMembersLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchTerm.trim()) {
        fetchTeamMembers();
      }
    }, 100);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, dispatch]);

  const handleSelectChange = async (memberId: string) => {
    if (!projectId || !memberId) return;

    try {
      const res = await dispatch(addProjectMember({ memberId, projectId })).unwrap();
      if (res.done) {
        form.resetFields();
        dispatch(
          getTeamMembers({
            index: 1,
            size: 5,
            field: null,
            order: null,
            search: null,
            all: true,
          })
        );
        await fetchProjectMembers();
      }
    } catch (error) {
      logger.error('Error adding member:', error);
    }
  };

  const handleDeleteMember = async (memberId: string | undefined) => {
    if (!memberId || !projectId) return;

    try {
      const res = await dispatch(deleteProjectMember({ memberId, projectId })).unwrap();
      if (res.done) {
        await fetchProjectMembers();
      }
    } catch (error) {
      logger.error('Error deleting member:', error);
    }
  };

  const handleOpenChange = () => {
    if (isDrawerOpen) {
      fetchProjectMembers();
      dispatch(
        getTeamMembers({
          index: 1,
          size: 5,
          field: null,
          order: null,
          search: null,
          all: true,
        })
      );
    }
  };

  const sendInviteToProject = async () => {
    if (!validateEmail(searchTerm) || !projectId) return;
    if (typeof searchTerm !== 'string' || !searchTerm.length) return;

    try {
      const email = searchTerm.trim().toLowerCase();
      const body = {
        email,
        project_id: projectId,
      };
      setIsInviting(true);
      const res = await dispatch(createByEmail(body)).unwrap();
      if (res.done) {
        form.resetFields();
        await fetchProjectMembers();
        dispatch(
          getTeamMembers({
            index: 1,
            size: 5,
            field: null,
            order: null,
            search: null,
            all: true,
          })
        );
      }
    } catch (error) {
      logger.error('Error sending invite:', error);
    } finally {
      setIsInviting(false);
      setSearchTerm('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      sendInviteToProject();
    }
  };

  const renderMemberOption = (member: any) => (
    <Flex gap={4} align="center">
      <SingleAvatar avatarUrl={member.avatar_url} name={member.name} email={member.email} />
      <Flex vertical>
        <Typography.Text style={{ textTransform: 'capitalize' }}>{member.name}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {member.email}
        </Typography.Text>
      </Flex>
    </Flex>
  );

  const renderNotFoundContent = () => (
    <Flex style={{ display: 'block' }}>
      <Button
        className="mb-2"
        block
        type="primary"
        onClick={sendInviteToProject}
        loading={isInviting}
        disabled={!validateEmail(searchTerm)}
      >
        <span>
          <MailOutlined /> &nbsp;
          {validateEmail(searchTerm) ? t('inviteAsAMember') : t('inviteNewMemberByEmail')}
        </span>
      </Button>
      {/* {isFromAssigner && <Flex>
          <input className='mr-2' type="checkbox" checked={true} name={t('alsoInviteToProject')} id="AlsoInviteToProject" />
          <label htmlFor={t('alsoInviteToProject')}>{t('alsoInviteToProject')}</label>
        </Flex>} */}
    </Flex>
  );

  return (
    <Modal
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {isFromAssigner ? t('inviteMember') : t('title')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onCancel={() => dispatch(toggleProjectMemberDrawer())}
      afterOpenChange={handleOpenChange}
      footer={
        <>
          {/* {!isFromAssigner && <Button
            style={{ width: 140, fontSize: 12 }}
            block
            icon={<LinkOutlined />}
            disabled
          >
            {t('copyProjectLink')}
          </Button>} */}
        </>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSelectChange}>
        <Form.Item name="memberName" label={t('searchLabel')}>
          <Select
            loading={teamMembersLoading}
            placeholder={t('searchPlaceholder')}
            showSearch
            onSearch={handleSearch}
            onChange={handleSelectChange}
            onKeyDown={handleKeyDown}
            options={availableMembers.map(member => ({
              key: member.id,
              value: member.id,
              name: member.name,
              label: renderMemberOption(member),
            }))}
            filterOption={false}
            notFoundContent={renderNotFoundContent()}
            optionLabelProp="name"
          />
        </Form.Item>
      </Form>
      {!isFromAssigner && (
        <>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{t('members')}</div>
          <div style={{ maxHeight: 360, minHeight: 120, overflowY: 'auto', marginBottom: 16 }}>
            <List
              loading={isLoading}
              bordered
              size="small"
              itemLayout="horizontal"
              dataSource={currentMembersList}
              renderItem={(member: any) => (
                <List.Item key={member.id}>
                  <Flex gap={4} align="center" justify="space-between" style={{ width: '100%' }}>
                    {renderMemberOption(member)}
                  </Flex>
                </List.Item>
              )}
            />
          </div>
        </>
      )}
    </Modal>
  );
};

export default ProjectMemberDrawer;
