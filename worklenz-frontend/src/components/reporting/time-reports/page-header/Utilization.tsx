import React, { useState, useMemo } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setSelectOrDeselectAllUtilization,
  setSelectOrDeselectUtilization,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Input,
  Avatar,
  theme,
  Space,
  CaretDownFilled,
  FilterOutlined,
  CheckCircleFilled,
  CheckboxChangeEvent,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const Utilization: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('time-report');
  const { utilization, loadingUtilization } = useAppSelector(
    state => state.timeReportsOverviewReducer
  );
  const { token } = theme.useToken();

  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(true);

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    return utilization.filter(item => item.selected).length;
  }, [utilization]);

  // Check if all options are selected
  const isAllSelected = utilization.length > 0 && utilization.every(item => item.selected);
  const isNoneSelected = utilization.length > 0 && !utilization.some(item => item.selected);

  // Filter members based on search text
  const filteredItems = utilization.filter(item =>
    item.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Theme-aware colors matching improved task filters
  const isDark = token.colorBgContainer !== '#ffffff';
  const colors = {
    headerText: isDark ? '#8c8c8c' : '#595959',
    borderColor: isDark ? '#404040' : '#f0f0f0',
    linkActive: isDark ? '#d9d9d9' : '#1890ff',
    linkDisabled: isDark ? '#8c8c8c' : '#d9d9d9',
    successColor: isDark ? '#52c41a' : '#52c41a',
    errorColor: isDark ? '#ff4d4f' : '#ff4d4f',
    buttonBorder: isDark ? '#303030' : '#d9d9d9',
    buttonText:
      activeFiltersCount > 0 ? (isDark ? 'white' : '#262626') : isDark ? '#d9d9d9' : '#595959',
    buttonBg:
      activeFiltersCount > 0 ? (isDark ? '#434343' : '#f5f5f5') : isDark ? '#141414' : 'white',
    dropdownBg: isDark ? '#1f1f1f' : 'white',
    dropdownBorder: isDark ? '#303030' : '#d9d9d9',
  };

  // Handle checkbox change for individual members
  const handleCheckboxChange = (id: string, selected: boolean) => {
    dispatch(setSelectOrDeselectUtilization({ id, selected }));
  };

  const handleSelectAll = (e: CheckboxChangeEvent) => {
    const isChecked = e.target.checked;
    setSelectAll(isChecked);
    dispatch(setSelectOrDeselectAllUtilization(isChecked));
  };

  // Handle select all button click
  const handleSelectAllClick = () => {
    const newValue = !isAllSelected;
    setSelectAll(newValue);
    dispatch(setSelectOrDeselectAllUtilization(newValue));
  };

  // Handle clear all
  const handleClearAll = () => {
    setSelectAll(false);
    dispatch(setSelectOrDeselectAllUtilization(false));
  };

  const getButtonText = () => {
    if (isNoneSelected) return t('utilization');
    if (isAllSelected) return `All ${t('utilization')}`;
    return `${t('utilization')} (${activeFiltersCount})`;
  };

  return (
    <Dropdown
      menu={undefined}
      placement="bottomLeft"
      trigger={['click']}
      dropdownRender={() => (
        <div
          style={{
            background: colors.dropdownBg,
            borderRadius: '8px',
            boxShadow: isDark
              ? '0 6px 16px 0 rgba(0, 0, 0, 0.32), 0 3px 6px -4px rgba(0, 0, 0, 0.32), 0 9px 28px 8px rgba(0, 0, 0, 0.20)'
              : '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
            border: `1px solid ${colors.dropdownBorder}`,
            padding: '4px 0',
            maxHeight: '330px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '4px 4px 2px',
              fontWeight: 600,
              fontSize: '12px',
              color: colors.headerText,
              borderBottom: `1px solid ${colors.borderColor}`,
              marginBottom: '2px',
            }}
          >
            {t('utilization')}
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
                  color: isAllSelected ? colors.linkDisabled : colors.linkActive,
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
                  color: isNoneSelected ? colors.linkDisabled : colors.errorColor,
                }}
              >
                {t('clearAll')}
              </Button>
            </Space>
          </div>

          <Divider style={{ margin: '2px 0', flexShrink: 0 }} />

          {/* Items */}
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
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s',
                }}
              >
                <Checkbox
                  onClick={e => e.stopPropagation()}
                  checked={ut.selected}
                  onChange={e => handleCheckboxChange(ut.id, e.target.checked)}
                  style={{ fontSize: '14px' }}
                >
                  <span style={{ marginLeft: '2px', fontSize: '14px' }}>{ut.name}</span>
                </Checkbox>
                {ut.selected && (
                  <CheckCircleFilled
                    style={{ color: colors.successColor, fontSize: '10px', marginLeft: 'auto' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    >
      <Button
        loading={loadingUtilization}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '30px',
          fontSize: '12px',
          borderColor: colors.buttonBorder,
          color: colors.buttonText,
          fontWeight: activeFiltersCount > 0 ? 600 : 400,
          transition: 'all 0.2s ease-in-out',
          backgroundColor: colors.buttonBg,
          borderRadius: '6px',
          padding: '4px 10px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f0f0f0';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = colors.buttonBg;
        }}
      >
        <FilterOutlined
          style={{
            fontSize: '14px',
            color: colors.buttonText,
          }}
        />
        <span>{getButtonText()}</span>
        <CaretDownFilled
          style={{
            fontSize: '10px',
            marginLeft: '2px',
            color: colors.buttonText,
          }}
        />
      </Button>
    </Dropdown>
  );
};

export default Utilization;
