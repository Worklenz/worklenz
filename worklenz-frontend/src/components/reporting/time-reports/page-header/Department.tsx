import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Input,
  Space,
  CaretDownFilled,
  CheckCircleFilled,
  theme,
  Typography,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setSelectOrDeselectAllDepartments, setSelectOrDeselectDepartment } from '@/features/reporting/time-reports/time-reports-overview.slice';

interface DepartmentProps {
  disabled?: boolean;
}

const NO_DEPARTMENT_FILTER_ID = '__no_department__';

const Department: React.FC<DepartmentProps> = ({ disabled = false }) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();
  const { departments, loadingDepartments } = useAppSelector(state => state.timeReportsOverviewReducer);
  const [searchText, setSearchText] = useState('');

  const selectedCount = useMemo(() => departments.filter(d => d.selected).length, [departments]);
  const allSelected = departments.length > 0 && selectedCount === departments.length;
  const noneSelected = departments.length > 0 && selectedCount === 0;
  const noDepartmentLabel = t('noDepartmentOption', { defaultValue: 'No Department' });
  const filteredDepartments = useMemo(
    () =>
      departments.filter(d => {
        const filterText = searchText.toLowerCase();
        const label = d.id === NO_DEPARTMENT_FILTER_ID ? noDepartmentLabel : d.name;
        return label?.toLowerCase().includes(filterText);
      }),
    [departments, searchText, noDepartmentLabel]
  );

  const isDark = token.colorBgContainer !== '#ffffff';
  const colors = {
    headerText: isDark ? '#8c8c8c' : '#595959',
    borderColor: isDark ? '#404040' : '#f0f0f0',
    linkActive: isDark ? '#d9d9d9' : '#1890ff',
    linkDisabled: isDark ? '#8c8c8c' : '#d9d9d9',
    errorColor: isDark ? '#ff4d4f' : '#ff4d4f',
    buttonBorder: isDark ? '#303030' : '#d9d9d9',
    buttonText: allSelected ? (isDark ? '#d9d9d9' : '#595959') : isDark ? 'white' : '#262626',
    buttonBg: allSelected ? (isDark ? '#141414' : 'white') : isDark ? '#434343' : '#f5f5f5',
    dropdownBg: isDark ? '#1f1f1f' : 'white',
    dropdownBorder: isDark ? '#303030' : '#d9d9d9',
    successColor: isDark ? '#52c41a' : '#52c41a',
  };

  return (
    <Dropdown
      menu={undefined}
      placement="bottomLeft"
      trigger={['click']}
      popupRender={() => (
        <div
          style={{
            background: colors.dropdownBg,
            borderRadius: '8px',
            border: `1px solid ${colors.dropdownBorder}`,
            padding: '4px 0',
            width: '300px',
            maxHeight: '330px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '4px 4px 2px', fontWeight: 600, fontSize: '12px', color: colors.headerText }}>
            {t('departmentFilterLabel', { defaultValue: 'Department' })}
          </div>
          <div style={{ padding: '4px 8px', flexShrink: 0 }}>
            <Input
              onClick={e => e.stopPropagation()}
              placeholder={t('searchByDepartment', { defaultValue: 'Search department' })}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ fontSize: '14px' }}
            />
          </div>
          <div style={{ padding: '2px 8px', marginBottom: '2px' }}>
            <Space size="small">
              <Button
                type="link"
                size="small"
                onClick={() => dispatch(setSelectOrDeselectAllDepartments(true))}
                disabled={allSelected}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: allSelected ? colors.linkDisabled : colors.linkActive,
                }}
              >
                {t('selectAll', { defaultValue: 'Select All' })}
              </Button>
              <Divider type="vertical" style={{ margin: '0 2px' }} />
              <Button
                type="link"
                size="small"
                onClick={() => dispatch(setSelectOrDeselectAllDepartments(false))}
                disabled={noneSelected}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: noneSelected ? colors.linkDisabled : colors.errorColor,
                }}
              >
                {t('clearAll', { defaultValue: 'Clear All' })}
              </Button>
            </Space>
          </div>
          <Divider style={{ margin: '2px 0', flexShrink: 0 }} />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredDepartments.length === 0 ? (
              <Typography.Text style={{ fontSize: '11px', color: colors.headerText, padding: '4px 8px', display: 'block' }}>
                {t('noDepartments', { defaultValue: 'No departments found' })}
              </Typography.Text>
            ) : (
              filteredDepartments.map(department => (
                <div key={department.id} style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Checkbox
                    onClick={e => e.stopPropagation()}
                    checked={department.selected}
                    onChange={e => dispatch(setSelectOrDeselectDepartment({ id: department.id!, selected: e.target.checked }))}
                  >
                    <span style={{ fontSize: '14px' }}>
                      {department.id === NO_DEPARTMENT_FILTER_ID ? noDepartmentLabel : department.name}
                    </span>
                  </Checkbox>
                  {department.selected && <CheckCircleFilled style={{ color: colors.successColor, fontSize: '10px' }} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    >
      <Button
        loading={loadingDepartments}
        disabled={disabled || loadingDepartments}
        size="small"
        style={{ fontSize: 12, borderRadius: 7 }}
      >
        {`${t('departmentFilterLabel', { defaultValue: 'Department' })} (${selectedCount})`}
        {!loadingDepartments && <CaretDownFilled style={{ fontSize: 10, marginLeft: 4 }} />}
      </Button>
    </Dropdown>
  );
};

export default Department;
