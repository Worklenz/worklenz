import React, { useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setSelectOrDeselectAllMembers, setSelectOrDeselectMember } from '@/features/reporting/time-reports/time-reports-overview.slice';
import { Button, Checkbox, Divider, Dropdown, Input, Avatar, theme } from 'antd';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import { CaretDownFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const Members: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('time-report');
  const { members, loadingMembers } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { token } = theme.useToken();

  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(true);

  // Filter members based on search text
  const filteredMembers = members.filter(member =>
    member.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Handle checkbox change for individual members
  const handleCheckboxChange = (id: string, checked: boolean) => {
    console.log('Select Change:', id);
    dispatch(setSelectOrDeselectMember({ id, selected: checked }));
  };

  // Handle "Select All" checkbox change
  const handleSelectAllChange = (e: CheckboxChangeEvent) => {
    console.log('Select All Change:', e);
    const isChecked = e.target.checked;
    setSelectAll(isChecked);
    dispatch(setSelectOrDeselectAllMembers(isChecked));
  };

  return (
    <Dropdown
      menu={undefined}
      placement="bottomLeft"
      trigger={['click']}
      dropdownRender={() => (
        <div
          style={{
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            boxShadow: token.boxShadow,
            padding: '4px 0',
            maxHeight: '330px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '8px', flexShrink: 0 }}>
            <Input
              onClick={e => e.stopPropagation()}
              placeholder={t('searchByMember')}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
          <div style={{ padding: '0 12px', flexShrink: 0 }}>
            <Checkbox
              onClick={e => e.stopPropagation()}
              onChange={handleSelectAllChange}
              checked={selectAll}
            >
              {t('selectAll')}
            </Checkbox>
          </div>
          <Divider style={{ margin: '4px 0', flexShrink: 0 }} />
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {filteredMembers.map(member => (
              <div
                key={member.id}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: token.colorBgTextHover,
                  },
                }}
              >
                <Avatar src={member.avatar_url} alt={member.name} />
                <Checkbox
                  onClick={e => e.stopPropagation()}
                  checked={member.selected}
                  onChange={e => handleCheckboxChange(member.id, e.target.checked)}
                >
                  {member.name}
                </Checkbox>
              </div>
            ))}
          </div>
        </div>
      )}
    >
      <Button loading={loadingMembers}>
        {t('members')} <CaretDownFilled />
      </Button>
    </Dropdown>
  );
};

export default Members;