import React, { useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setSelectOrDeselectAllMembers, setSelectOrDeselectAllUtilization, setSelectOrDeselectMember, setSelectOrDeselectUtilization } from '@/features/reporting/time-reports/time-reports-overview.slice';
import { Button, Checkbox, Divider, Dropdown, Input, Avatar, theme } from 'antd';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import { CaretDownFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { id } from 'date-fns/locale';

const Utilization: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('time-report');
  const { utilization, loadingUtilization } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { token } = theme.useToken();

  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(true);

  // Filter members based on search text
  const filteredItems = utilization.filter(item =>
    item.name?.toLowerCase().includes(searchText.toLowerCase())
  );
  // Handle checkbox change for individual members
  const handleCheckboxChange = (id: string, selected: boolean) => {
    dispatch(setSelectOrDeselectUtilization({ id, selected }));
  };

  const handleSelectAll = (e: CheckboxChangeEvent) => {
    const isChecked = e.target.checked;
    setSelectAll(isChecked);
    dispatch(setSelectOrDeselectAllUtilization(isChecked));
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
          </div>
          <div style={{ padding: '0 12px', flexShrink: 0 }}>
            <Checkbox
              onClick={e => e.stopPropagation()}
              onChange={handleSelectAll}
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
            {filteredItems.map((ut, index) => (
              <div
                key={index}
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
                <Checkbox
                  onClick={e => e.stopPropagation()}
                  checked={ut.selected}
                  onChange={e => handleCheckboxChange(ut.id, e.target.checked)}
                >
                  {ut.name}
                </Checkbox>
              </div>
            ))}
          </div>
        </div>
      )}
    >
      <Button loading={loadingUtilization}>
        {t('utilization')} <CaretDownFilled />
      </Button>
    </Dropdown>
  );
};

export default Utilization;