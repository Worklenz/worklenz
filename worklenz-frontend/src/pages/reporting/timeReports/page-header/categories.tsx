import {
  fetchReportingProjects,
  setNoCategory,
  setSelectOrDeselectAllCategories,
  setSelectOrDeselectCategory,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { CaretDownFilled } from '@ant-design/icons';
import { Button, Card, Checkbox, Divider, Dropdown, Input, theme } from 'antd';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const Categories: React.FC = () => {
  const dispatch = useAppDispatch();

  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const { t } = useTranslation('time-report');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { categories, loadingCategories, noCategory } = useAppSelector(
    state => state.timeReportsOverviewReducer
  );
  const { token } = theme.useToken();

  const filteredItems = categories.filter(item =>
    item.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Handle checkbox change for individual items
  const handleCheckboxChange = async (key: string, checked: boolean) => {
    await dispatch(setSelectOrDeselectCategory({ id: key, selected: checked }));
    await dispatch(fetchReportingProjects());
  };

  // Handle "Select All" checkbox change
  const handleSelectAllChange = async (e: CheckboxChangeEvent) => {
    const isChecked = e.target.checked;
    setSelectAll(isChecked);
    await dispatch(setNoCategory(isChecked));
    await dispatch(setSelectOrDeselectAllCategories(isChecked));
    await dispatch(fetchReportingProjects());
  };

  const handleNoCategoryChange = async (checked: boolean) => {
    await dispatch(setNoCategory(checked));
    await dispatch(fetchReportingProjects());
  };

  return (
    <div>
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
                placeholder={t('searchByCategory')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            {categories.length > 0 && (
              <div style={{ padding: '0 12px', flexShrink: 0 }}>
                <Checkbox
                  onClick={e => e.stopPropagation()}
                  onChange={handleSelectAllChange}
                  checked={selectAll}
                >
                  {t('selectAll')}
                </Checkbox>
              </div>
            )}
            <div style={{ padding: '8px 12px 4px 12px', flexShrink: 0 }}>
              <Checkbox
                onClick={e => e.stopPropagation()}
                checked={noCategory}
                onChange={e => handleNoCategoryChange(e.target.checked)}
              >
                {t('noCategory')}
              </Checkbox>
            </div>
            <Divider style={{ margin: '4px 0', flexShrink: 0 }} />
            <div
              style={{
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
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
                ))
              ) : (
                <div style={{ padding: '8px 12px' }}>{t('noCategories')}</div>
              )}
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
        <Button loading={loadingCategories}>
          {t('categories')} <CaretDownFilled />
        </Button>
      </Dropdown>
    </div>
  );
};

export default Categories;
