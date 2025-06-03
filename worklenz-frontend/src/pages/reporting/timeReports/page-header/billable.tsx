import { setSelectOrDeselectBillable } from '@/features/reporting/time-reports/time-reports-overview.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { CaretDownFilled, FilterOutlined, CheckCircleFilled } from '@ant-design/icons';
import { Button, Checkbox, Dropdown, MenuProps, Space, Badge, Divider, theme } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const Billable: React.FC = () => {
  const { t } = useTranslation('time-report');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();

  const { billable } = useAppSelector(state => state.timeReportsOverviewReducer);

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (billable.billable) count++;
    if (billable.nonBillable) count++;
    return count;
  }, [billable.billable, billable.nonBillable]);

  // Check if all options are selected
  const isAllSelected = billable.billable && billable.nonBillable;
  const isNoneSelected = !billable.billable && !billable.nonBillable;

  // Handle select all
  const handleSelectAll = () => {
    dispatch(setSelectOrDeselectBillable({ 
      billable: true, 
      nonBillable: true 
    }));
  };

  // Handle clear all
  const handleClearAll = () => {
    dispatch(setSelectOrDeselectBillable({ 
      billable: false, 
      nonBillable: false 
    }));
  };

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

  // Dropdown items for the menu
  const menuItems: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <div style={{ 
          padding: '4px 4px 2px', 
          fontWeight: 600, 
          fontSize: '12px',
          color: colors.headerText,
          borderBottom: `1px solid ${colors.borderColor}`,
          marginBottom: '2px'
        }}>
          {t('filterByBillableStatus')}
        </div>
      ),
      disabled: true,
    },
    {
      key: 'actions',
      label: (
        <div style={{ padding: '2px 4px', marginBottom: '2px' }}>
          <Space size="small">
            <Button 
              type="link" 
              size="small" 
              onClick={handleSelectAll}
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
      ),
      disabled: true,
    },
    {
      key: 'billable',
      label: (
        <div 
          style={{ 
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '4px',
            transition: 'background-color 0.2s'
          }}
        >
          <Checkbox checked={billable.billable} style={{ fontSize: '14px' }}>
            <span style={{ marginLeft: '2px', fontSize: '14px' }}>{t('billable')}</span>
          </Checkbox>
          {billable.billable && (
            <CheckCircleFilled style={{ color: colors.successColor, fontSize: '10px' }} />
          )}
        </div>
      ),
      onClick: () => {
        dispatch(setSelectOrDeselectBillable({ ...billable, billable: !billable.billable }));
      },
    },
    {
      key: 'nonBillable',
      label: (
        <div 
          style={{ 
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '4px',
            transition: 'background-color 0.2s'
          }}
        >
          <Checkbox checked={billable.nonBillable} style={{ fontSize: '14px' }}>
            <span style={{ marginLeft: '2px', fontSize: '14px' }}>{t('nonBillable')}</span>
          </Checkbox>
          {billable.nonBillable && (
            <CheckCircleFilled style={{ color: colors.successColor, fontSize: '10px' }} />
          )}
        </div>
      ),
      onClick: () => {
        dispatch(setSelectOrDeselectBillable({ ...billable, nonBillable: !billable.nonBillable }));
      },
    },
  ];

  // Button text based on selection state
  const getButtonText = () => {
    if (isNoneSelected) return t('billable');
    if (isAllSelected) return t('allBillableTypes');
    if (billable.billable && !billable.nonBillable) return t('billable');
    if (!billable.billable && billable.nonBillable) return t('nonBillable');
    return t('billable');
  };

  return (
    <div>
      <Dropdown
        menu={{ items: menuItems }}
        placement="bottomLeft"
        trigger={['click']}
        overlayStyle={{ 
          maxHeight: '330px', 
          overflowY: 'auto',
          boxShadow: isDark 
            ? '0 6px 16px 0 rgba(0, 0, 0, 0.32), 0 3px 6px -4px rgba(0, 0, 0, 0.32), 0 9px 28px 8px rgba(0, 0, 0, 0.20)'
            : '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
          borderRadius: '8px',
          border: `1px solid ${colors.dropdownBorder}`,
          backgroundColor: colors.dropdownBg
        }}
        overlayClassName="billable-filter-dropdown"
      >
        <Button
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

export default Billable;
