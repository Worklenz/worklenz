/* eslint-disable react-hooks/exhaustive-deps */
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputRef,
  List,
  Typography,
} from '@/shared/antd-imports';
import React, { useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '../../../features/projects/singleProject/members/projectMembersSlice';
import CustomAvatar from '../../CustomAvatar';
import { colors } from '../../../styles/colors';
import { PlusOutlined, UsergroupAddOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { ITaskAssignee } from '@/types/tasks/task.types';

interface AssigneeSelectorProps {
  taskId: string | undefined | null;
  currentAssignees: ITaskAssignee[] | string[];
}

const AssigneeSelector = ({ taskId, currentAssignees }: AssigneeSelectorProps) => {
  const membersInputRef = useRef<InputRef>(null);
  // this is for get the current string that type on search bar
  const [searchQuery, setSearchQuery] = useState<string>('');

  // localization
  const { t } = useTranslation('task-list-table');

  const dispatch = useAppDispatch();

  // get members list from members reducer
  const membersList = [
    ...useAppSelector(state => state.memberReducer.membersList),
    useAppSelector(state => state.memberReducer.owner),
  ];

  // used useMemo hook for re render the list when searching
  const filteredMembersData = useMemo(() => {
    return membersList.filter(member =>
      member.memberName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [membersList, searchQuery]);

  // function to handle invite project member drawer
  const handleInviteProjectMemberDrawer = () => {
    dispatch(toggleProjectMemberDrawer());
  };

  // function to focus members input
  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        membersInputRef.current?.focus();
      }, 0);
    }
  };

  // custom dropdown content
  const membersDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={membersInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder')}
        />

        <List style={{ padding: 0 }}>
          {filteredMembersData.length ? (
            filteredMembersData.map(member => (
              <List.Item
                className="custom-list-item"
                key={member.memberId}
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-start',
                  padding: '4px 8px',
                  border: 'none',
                }}
              >
                <Checkbox id={member.memberId} onChange={() => {}} />
                <div>
                  <CustomAvatar avatarName={member.memberName} />
                </div>
                <Flex vertical>
                  {member.memberName}

                  <Typography.Text
                    style={{
                      fontSize: 12,
                      color: colors.lightGray,
                    }}
                  >
                    {member.memberEmail}
                  </Typography.Text>
                </Flex>
              </List.Item>
            ))
          ) : (
            <Empty />
          )}
        </List>

        <Divider style={{ marginBlock: 0 }} />

        <Button
          icon={<UsergroupAddOutlined />}
          type="text"
          style={{
            color: colors.skyBlue,
            border: 'none',
            backgroundColor: colors.transparent,
            width: '100%',
          }}
          onClick={handleInviteProjectMemberDrawer}
        >
          {t('assigneeSelectorInviteButton')}
        </Button>

        {/* <Divider style={{ marginBlock: 8 }} />

        <Button type="primary" style={{ alignSelf: 'flex-end' }}>
          {t('okButton')}
        </Button> */}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => membersDropdownContent}
      onOpenChange={handleMembersDropdownOpen}
    >
      <Button
        type="dashed"
        shape="circle"
        size="small"
        icon={
          <PlusOutlined
            style={{
              fontSize: 12,
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        }
      />
    </Dropdown>
  );
};

export default AssigneeSelector;
