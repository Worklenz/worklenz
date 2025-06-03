import { setSelectOrDeselectAllProjects, setSelectOrDeselectProject } from '@/features/reporting/time-reports/time-reports-overview.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { CaretDownFilled, FilterOutlined, CheckCircleFilled } from '@ant-design/icons';
import { Button, Checkbox, Divider, Dropdown, Input, theme, Space } from 'antd';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import React, { useState, useMemo } from 'react';
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

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    return projects.filter(project => project.selected).length;
  }, [projects]);

  // Check if all options are selected
  const isAllSelected = projects.length > 0 && projects.every(project => project.selected);
  const isNoneSelected = projects.length > 0 && !projects.some(project => project.selected);

  // Filter items based on search text
  const filteredItems = projects.filter(item =>
    item.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Theme-aware colors
  const isDark = token.colorBgContainer !== '#ffffff';
  const colors = {
    headerText: isDark ? token.colorTextSecondary : '#262626',
    borderColor: isDark ? token.colorBorder : '#f0f0f0',
    linkActive: token.colorPrimary,
    linkDisabled: isDark ? token.colorTextDisabled : '#d9d9d9',
    successColor: token.colorSuccess,
    errorColor: token.colorError,
    buttonBorder: activeFiltersCount > 0 ? token.colorPrimary : token.colorBorder,
    buttonText: activeFiltersCount > 0 ? token.colorPrimary : token.colorTextSecondary,
    buttonBg: activeFiltersCount > 0 ? (isDark ? token.colorPrimaryBg : '#f6ffed') : 'transparent',
    dropdownBg: token.colorBgElevated,
    dropdownBorder: token.colorBorderSecondary,
  };

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

  // Handle select all button click
  const handleSelectAllClick = () => {
    const newValue = !isAllSelected;
    setSelectAll(newValue);
    dispatch(setSelectOrDeselectAllProjects(newValue));
  };

  // Handle clear all
  const handleClearAll = () => {
    setSelectAll(false);
    dispatch(setSelectOrDeselectAllProjects(false));
  };

  const getButtonText = () => {
    if (isNoneSelected) return t('projects');
    if (isAllSelected) return `All ${t('projects')}`;
    return `${t('projects')} (${activeFiltersCount})`;
  };

  return (
    <div>
      <Dropdown
        menu={undefined}
        placement="bottomLeft"
        trigger={['click']}
        dropdownRender={() => (
          <div style={{ 
            background: colors.dropdownBg,
            borderRadius: '8px',
            boxShadow: isDark 
              ? '0 6px 16px 0 rgba(0, 0, 0, 0.32), 0 3px 6px -4px rgba(0, 0, 0, 0.32), 0 9px 28px 8px rgba(0, 0, 0, 0.20)'
              : '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
            border: `1px solid ${colors.dropdownBorder}`,
            padding: '4px 0',
            maxHeight: '330px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ 
              padding: '4px 4px 2px', 
              fontWeight: 600, 
              fontSize: '12px',
              color: colors.headerText,
              borderBottom: `1px solid ${colors.borderColor}`,
              marginBottom: '2px'
            }}>
              {t('searchByProject')}
            </div>

            {/* Search */}
            <div style={{ padding: '4px 8px', flexShrink: 0 }}>
              <Input
                onClick={e => e.stopPropagation()}
                placeholder={t('searchByProject')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ fontSize: '14px' }}
              />
            </div>

            {/* Actions */}
            <div style={{ padding: '2px 8px', marginBottom: '2px' }}>
              <Space size="small">
                <Button 
                  type="link" 
                  size="small" 
                  onClick={handleSelectAllClick}
                  disabled={isAllSelected}
                  style={{ 
                    padding: '0 2px', 
                    height: 'auto',
                    fontSize: '11px',
                    color: isAllSelected ? colors.linkDisabled : colors.linkActive
                  }}
                >
                  {t('selectAll')}
                </Button>
                <Divider type="vertical" style={{ margin: '0 2px' }} />
                <Button 
                  type="link" 
                  size="small" 
                  onClick={handleClearAll}
                  disabled={isNoneSelected}
                  style={{ 
                    padding: '0 2px', 
                    height: 'auto',
                    fontSize: '11px',
                    color: isNoneSelected ? colors.linkDisabled : colors.errorColor
                  }}
                >
                  {t('clearAll')}
                </Button>
              </Space>
            </div>

            <Divider style={{ margin: '2px 0', flexShrink: 0 }} />
            
            {/* Items */}
            <div style={{ 
              overflowY: 'auto',
              flex: 1
            }}>
              {filteredItems.map(item => (
                <div 
                  key={item.id}
                  style={{ 
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <Checkbox
                    onClick={e => e.stopPropagation()}
                    checked={item.selected}
                    onChange={e => handleCheckboxChange(item.id || '', e.target.checked)}
                    style={{ fontSize: '14px' }}
                  >
                    <span style={{ marginLeft: '2px', fontSize: '14px' }}>{item.name}</span>
                  </Checkbox>
                  {item.selected && (
                    <CheckCircleFilled style={{ color: colors.successColor, fontSize: '10px' }} />
                  )}
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
        <Button 
          loading={loadingProjects}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: '32px',
            borderColor: colors.buttonBorder,
            color: colors.buttonText,
            fontWeight: activeFiltersCount > 0 ? 500 : 400,
            transition: 'all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
            backgroundColor: colors.buttonBg,
          }}
          onMouseEnter={(e) => {
            if (activeFiltersCount > 0) {
              e.currentTarget.style.borderColor = token.colorPrimaryHover;
              e.currentTarget.style.boxShadow = `0 2px 4px ${token.colorPrimary}20`;
            }
          }}
          onMouseLeave={(e) => {
            if (activeFiltersCount > 0) {
              e.currentTarget.style.borderColor = token.colorPrimary;
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          <FilterOutlined 
            style={{ 
              fontSize: '14px',
              color: activeFiltersCount > 0 ? token.colorPrimary : token.colorTextTertiary
            }} 
          />
          <span>{getButtonText()}</span>
          <CaretDownFilled 
            style={{ 
              fontSize: '10px',
              marginLeft: '2px'
            }} 
          />
        </Button>
      </Dropdown>
    </div>
  );
};

export default Projects;
