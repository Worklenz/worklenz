/* eslint-disable react-hooks/exhaustive-deps */
import { CaretDownFilled } from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputRef,
  List,
  Space,
  Typography,
} from 'antd';
import { useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import CustomAvatar from '@components/CustomAvatar';
import { useTranslation } from 'react-i18next';

const MembersFilterDropdown = () => {
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const membersInputRef = useRef<InputRef>(null);

  const members = useAppSelector(state => state.memberReducer.membersList);

  const { t } = useTranslation('task-list-filters');

  const membersList = [...members, useAppSelector(state => state.memberReducer.owner)];

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // this is for get the current string that type on search bar
  const [searchQuery, setSearchQuery] = useState<string>('');

  // used useMemo hook for re render the list when searching
  const filteredMembersData = useMemo(() => {
    return membersList.filter(member =>
      member.memberName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [membersList, searchQuery]);

  // handle selected filters count
  const handleSelectedFiltersCount = (checked: boolean) => {
    setSelectedCount(prev => (checked ? prev + 1 : prev - 1));
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
                className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                key={member.memberId}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '4px 8px',
                  border: 'none',
                }}
              >
                <Checkbox
                  id={member.memberId}
                  onChange={e => handleSelectedFiltersCount(e.target.checked)}
                />
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
      </Flex>
    </Card>
  );

  // function to focus members input
  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        membersInputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => membersDropdownContent}
      onOpenChange={handleMembersDropdownOpen}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        style={{
          backgroundColor: selectedCount > 0 ? colors.paleBlue : colors.transparent,

          color: selectedCount > 0 ? colors.darkGray : 'inherit',
        }}
      >
        <Space>
          {t('membersText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default MembersFilterDropdown;
