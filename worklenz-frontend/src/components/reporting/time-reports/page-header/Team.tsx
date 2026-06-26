import React, { useState, useMemo } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchReportingCategories,
  fetchReportingProjects,
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectTeam,
} from '@/features/reporting/time-reports/time-reports-overview.slice';

const Team: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const { t } = useTranslation('time-report');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { token } = theme.useToken();

  const { teams, loadingTeams } = useAppSelector(state => state.timeReportsOverviewReducer);

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    return teams.filter(team => team.selected).length;
  }, [teams]);

  // Check if all options are selected
  const isAllSelected = teams.length > 0 && teams.every(team => team.selected);
  const isNoneSelected = teams.length > 0 && !teams.some(team => team.selected);

  const filteredItems = teams.filter(item =>
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

  const handleCheckboxChange = async (key: string, checked: boolean) => {
    dispatch(setSelectOrDeselectTeam({ id: key, selected: checked }));
    await dispatch(fetchReportingCategories());
    await dispatch(fetchReportingProjects());
  };

  const handleSelectAllChange = async (e: CheckboxChangeEvent) => {
    const isChecked = e.target.checked;
    setSelectAll(isChecked);
    dispatch(setSelectOrDeselectAllTeams(isChecked));
    await dispatch(fetchReportingCategories());
    await dispatch(fetchReportingProjects());
  };

  // Handle clear all
  const handleClearAll = async () => {
    setSelectAll(false);
    dispatch(setSelectOrDeselectAllTeams(false));
    await dispatch(fetchReportingCategories());
    await dispatch(fetchReportingProjects());
  };

  // Handle select all button click
  const handleSelectAllClick = async () => {
    const newValue = !isAllSelected;
    setSelectAll(newValue);
    dispatch(setSelectOrDeselectAllTeams(newValue));
    await dispatch(fetchReportingCategories());
    await dispatch(fetchReportingProjects());
  };

  const getButtonText = () => {
    if (isNoneSelected) return t('teams');
    if (isAllSelected) return `All ${t('teams')}`;
    return `${t('teams')} (${activeFiltersCount})`;
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
              {t('searchByName')}
            </div>

            {/* Search */}
            <div style={{ padding: '4px 8px', flexShrink: 0 }}>
              <Input
                placeholder={t('searchByName')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onClick={e => e.stopPropagation()}
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
          loading={loadingTeams}
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

export default Team;
