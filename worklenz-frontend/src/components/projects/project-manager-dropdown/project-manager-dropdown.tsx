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
  disabled?: boolean;
  /** Injected by Ant Design Form.Item */
  value?: ITeamMemberViewModel | null;
  /** Injected by Ant Design Form.Item */
  onChange?: (member: ITeamMemberViewModel | null) => void;
}

const getValidProjectManager = (
  manager?: ITeamMemberViewModel | null
): ITeamMemberViewModel | null => {
  if (!manager?.id) return null;
  return manager;
};

const ProjectManagerDropdown: React.FC<ProjectManagerDropdownProps> = ({
  selectedProjectManager,
  setSelectedProjectManager,
  disabled = false,
  value = null,
  onChange,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-drawer');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const labelInputRef = useRef<InputRef>(null);
  const { token } = theme.useToken();
  const { teamMembers } = useAppSelector(state => state.teamMembersReducer);

  const displayProjectManager = useMemo(() => {
    return getValidProjectManager(selectedProjectManager) || getValidProjectManager(value);
  }, [selectedProjectManager, value]);

  useEffect(() => {
    // Keep member list available for id-only enrichment; skip search fetches when disabled
    if (disabled && searchQuery) return;
    dispatch(getTeamMembers({ index: 1, size: 30, field: null, order: null, search: searchQuery || null }));
  }, [dispatch, searchQuery, disabled]);

  // Enrich id-only manager (e.g. from project list payload) using loaded team members
  useEffect(() => {
    if (!displayProjectManager?.id || displayProjectManager.name) return;

    const matchedMember = teamMembers?.data?.find(member => member.id === displayProjectManager.id);
    if (!matchedMember) return;

    setSelectedProjectManager(matchedMember);
    onChange?.(matchedMember);
  }, [displayProjectManager, teamMembers, setSelectedProjectManager, onChange]);

  const projectManagerOptions = useMemo(() => {
    return (
      teamMembers?.data?.map((member, index) => ({
        key: index,
        value: member.id,
        label: (
          <Flex
            align="center"
            gap="0px"
            onClick={() => {
              if (disabled) return;
              setSelectedProjectManager(member);
              onChange?.(member);
            }}
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
  }, [teamMembers, disabled, setSelectedProjectManager, onChange]);

  const contentStyle: React.CSSProperties = {
    backgroundColor: token.colorBgElevated,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
    margin: '12px',
  };

  const projectManagerOptionsDropdownRender = (menu: React.ReactNode) => {
    return (
      <div style={contentStyle}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder', { defaultValue: 'Search' })}
          style={{ width: 'auto', margin: '5px' }}
          autoComplete="off"
        />
        {menu}
      </div>
    );
  };

  const handleClearProjectManager = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    setSelectedProjectManager(null);
    onChange?.(null);
  };

  return (
    <Dropdown
      menu={{
        items: projectManagerOptions,
        style: {
          maxHeight: '255px',
          overflowY: 'auto',
          border: 'none',
        },
      }}
      trigger={['click']}
      dropdownRender={projectManagerOptionsDropdownRender}
      disabled={disabled}
    >
      <div
        className={`project-manager-container ${displayProjectManager ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
        aria-disabled={disabled}
      >
        {displayProjectManager ? (
          <>
            <SingleAvatar
              avatarUrl={displayProjectManager.avatar_url}
              name={displayProjectManager.name}
              email={displayProjectManager.email}
            />
            <Typography.Text>{displayProjectManager.name}</Typography.Text>
            {!disabled && (
              <CloseCircleFilled
                className="project-manager-icon"
                onClick={handleClearProjectManager}
                aria-label={t('clearProjectManager', { defaultValue: 'Clear project manager' })}
              />
            )}
          </>
        ) : (
          <Button
            type="dashed"
            shape="circle"
            icon={<PlusCircleOutlined />}
            disabled={disabled}
            aria-label={t('projectManager', { defaultValue: 'Project Manager' })}
          />
        )}
      </div>
    </Dropdown>
  );
};

export default ProjectManagerDropdown;
