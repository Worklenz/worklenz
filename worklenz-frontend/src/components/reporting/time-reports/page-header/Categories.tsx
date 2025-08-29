import {
  fetchReportingProjects,
  setNoCategory,
  setSelectOrDeselectAllCategories,
  setSelectOrDeselectCategory,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Input,
  theme,
  Space,
  CaretDownFilled,
  FilterOutlined,
  CheckCircleFilled,
  CheckboxChangeEvent,
} from '@/shared/antd-imports';
import React, { useState, useMemo } from 'react';
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

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    const selectedCategories = categories.filter(category => category.selected).length;
    return selectedCategories + (noCategory ? 1 : 0);
  }, [categories, noCategory]);

  // Check if all options are selected
  const isAllSelected =
    categories.length > 0 && categories.every(category => category.selected) && noCategory;
  const isNoneSelected =
    categories.length > 0 && !categories.some(category => category.selected) && !noCategory;

  const filteredItems = categories.filter(item =>
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

  // Handle select all button click
  const handleSelectAllClick = async () => {
    const newValue = !isAllSelected;
    setSelectAll(newValue);
    await dispatch(setNoCategory(newValue));
    await dispatch(setSelectOrDeselectAllCategories(newValue));
    await dispatch(fetchReportingProjects());
  };

  // Handle clear all
  const handleClearAll = async () => {
    setSelectAll(false);
    await dispatch(setNoCategory(false));
    await dispatch(setSelectOrDeselectAllCategories(false));
    await dispatch(fetchReportingProjects());
  };

  const handleNoCategoryChange = async (checked: boolean) => {
    await dispatch(setNoCategory(checked));
    await dispatch(fetchReportingProjects());
  };

  const getButtonText = () => {
    if (isNoneSelected) return t('categories');
    if (isAllSelected) return `All ${t('categories')}`;
    return `${t('categories')} (${activeFiltersCount})`;
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
              {t('searchByCategory')}
            </div>

            {/* Search */}
            <div style={{ padding: '4px 8px', flexShrink: 0 }}>
              <Input
                onClick={e => e.stopPropagation()}
                placeholder={t('searchByCategory')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ fontSize: '14px' }}
              />
            </div>

            {/* Actions */}
            {categories.length > 0 && (
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
            )}

            {/* No Category Option */}
            <div
              style={{
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
              }}
            >
              <Checkbox
                onClick={e => e.stopPropagation()}
                checked={noCategory}
                onChange={e => handleNoCategoryChange(e.target.checked)}
                style={{ fontSize: '14px' }}
              >
                <span style={{ marginLeft: '2px', fontSize: '14px' }}>{t('noCategory')}</span>
              </Checkbox>
              {noCategory && (
                <CheckCircleFilled style={{ color: colors.successColor, fontSize: '10px' }} />
              )}
            </div>

            <Divider style={{ margin: '2px 0', flexShrink: 0 }} />

            {/* Items */}
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
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s',
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
                ))
              ) : (
                <div style={{ padding: '4px 8px', fontSize: '14px', color: colors.headerText }}>
                  {t('noCategories')}
                </div>
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
        <Button
          loading={loadingCategories}
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
    </div>
  );
};

export default Categories;
