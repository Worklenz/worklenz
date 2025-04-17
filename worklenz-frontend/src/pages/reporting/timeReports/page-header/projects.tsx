import { setSelectOrDeselectAllProjects, setSelectOrDeselectProject } from '@/features/reporting/time-reports/time-reports-overview.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { CaretDownFilled } from '@ant-design/icons';
import { Button, Checkbox, Divider, Dropdown, Input, theme } from 'antd';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const Projects: React.FC = () => {
  const dispatch = useAppDispatch();
  const [checkedList, setCheckedList] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const { t } = useTranslation('time-report');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { projects, loadingProjects } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { token } = theme.useToken();

  // Filter items based on search text
  const filteredItems = projects.filter(item =>
    item.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Handle checkbox change for individual items
  const handleCheckboxChange = (key: string, checked: boolean) => {
    dispatch(setSelectOrDeselectProject({ id: key, selected: checked }));
  };

  // Handle "Select All" checkbox change
  const handleSelectAllChange = (e: CheckboxChangeEvent) => {
    const isChecked = e.target.checked;
    setSelectAll(isChecked);
    dispatch(setSelectOrDeselectAllProjects(isChecked));
  };

  return (
    <div>
      <Dropdown
        menu={undefined}
        placement="bottomLeft"
        trigger={['click']}
        dropdownRender={() => (
          <div style={{ 
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            boxShadow: token.boxShadow,
            padding: '4px 0',
            maxHeight: '330px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '8px', flexShrink: 0 }}>
              <Input
                onClick={e => e.stopPropagation()}
                placeholder={t('searchByProject')}
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
            <div style={{ 
              overflowY: 'auto',
              flex: 1
            }}>
              {filteredItems.map(item => (
                <div 
                  key={item.id}
                  style={{ 
                    padding: '8px 12px',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: token.colorBgTextHover
                    }
                  }}
                >
                  <Checkbox
                    onClick={e => e.stopPropagation()}
                    checked={item.selected}
                    onChange={e => handleCheckboxChange(item.id || '', e.target.checked)}
                  >
                    {item.name}
                  </Checkbox>
                </div>
              ))}
            </div>
          </div>
        )}
        onOpenChange={visible => {
          setDropdownVisible(visible);
          if (!visible) {
            setSearchText('');
          }
        }}
      >
        <Button loading={loadingProjects}>
          {t('projects')} <CaretDownFilled />
        </Button>
      </Dropdown>
    </div>
  );
};

export default Projects;
