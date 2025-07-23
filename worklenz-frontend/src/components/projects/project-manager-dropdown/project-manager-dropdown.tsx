import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { CloseCircleFilled, PlusCircleOutlined } from '@/shared/antd-imports';
import { Button, Dropdown, Flex, Input, InputRef, theme, Typography } from '@/shared/antd-imports';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './project-manager-dropdown.css';

interface ProjectManagerDropdownProps {
  selectedProjectManager: ITeamMemberViewModel | null;
  setSelectedProjectManager: (member: ITeamMemberViewModel | null) => void;
  disabled: boolean;
}

const ProjectManagerDropdown: React.FC<ProjectManagerDropdownProps> = ({
  selectedProjectManager,
  setSelectedProjectManager,
  disabled = false,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-drawer');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const labelInputRef = useRef<InputRef>(null);
  const { token } = theme.useToken();
  const { teamMembers } = useAppSelector(state => state.teamMembersReducer);

  useEffect(() => {
    dispatch(getTeamMembers({ index: 1, size: 5, field: null, order: null, search: searchQuery }));
  }, [dispatch, searchQuery]);

  const projectManagerOptions = useMemo(() => {
    return (
      teamMembers?.data?.map((member, index) => ({
        key: index,
        value: member.id,
        label: (
          <Flex
            align="center"
            gap="0px"
            onClick={() => setSelectedProjectManager(member)}
            key={member.id}
          >
            <SingleAvatar avatarUrl={member.avatar_url} name={member.name} email={member.email} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Typography.Text style={{ fontSize: '14px' }}>{member.name}</Typography.Text>
              <Typography.Text
                type="secondary"
                style={{ fontSize: '11.2px', maxWidth: '212px' }}
                ellipsis={{ tooltip: true }}
              >
                {member.email}
              </Typography.Text>
            </div>
          </Flex>
        ),
      })) || []
    );
  }, [teamMembers]);

  const contentStyle: React.CSSProperties = {
    backgroundColor: token.colorBgElevated,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
    margin: '12px',
    maxHeight: '255px',
    overflow: 'auto',
  };

  const projectManagerOptionsDropdownRender = (menu: any) => {
    return (
      <div style={contentStyle}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder')}
          style={{ width: 'auto', margin: '5px' }}
          autoComplete="off"
        />
        {menu}
      </div>
    );
  };

  return (
    <Dropdown
      menu={{ items: projectManagerOptions }}
      trigger={['click']}
      dropdownRender={projectManagerOptionsDropdownRender}
      disabled={disabled}
    >
      <div className={`project-manager-container ${selectedProjectManager ? 'selected' : ''}`}>
        {selectedProjectManager ? (
          <>
            <SingleAvatar
              avatarUrl={selectedProjectManager.avatar_url}
              name={selectedProjectManager.name}
              email={selectedProjectManager.email}
            />
            <Typography.Text>{selectedProjectManager.name}</Typography.Text>
            {!disabled && (
              <CloseCircleFilled
                className="project-manager-icon"
                onClick={() => setSelectedProjectManager(null)}
              />
            )}
          </>
        ) : (
          <Button type="dashed" shape="circle" icon={<PlusCircleOutlined />} />
        )}
      </div>
    </Dropdown>
  );
};

export default ProjectManagerDropdown;
