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
import { setSelectOrDeselectAllPractices, setSelectOrDeselectPractice } from '@/features/reporting/time-reports/time-reports-overview.slice';

interface PracticeProps {
  disabled?: boolean;
}

const NO_PRACTICE_FILTER_ID = '__no_practice__';

const Practice: React.FC<PracticeProps> = ({ disabled = false }) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();
  const { practices, loadingPractices } = useAppSelector(state => state.timeReportsOverviewReducer);
  const [searchText, setSearchText] = useState('');

  const selectedCount = useMemo(() => practices.filter(p => p.selected).length, [practices]);
  const allSelected = practices.length > 0 && selectedCount === practices.length;
  const noneSelected = practices.length > 0 && selectedCount === 0;
  const noPracticeLabel = t('noPracticeOption', { defaultValue: 'No Practice' });
  const filteredPractices = useMemo(
    () =>
      practices.filter(p => {
        const filterText = searchText.toLowerCase();
        const label = p.id === NO_PRACTICE_FILTER_ID ? noPracticeLabel : p.name;
        return label?.toLowerCase().includes(filterText);
      }),
    [practices, searchText, noPracticeLabel]
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
            {t('practiceFilterLabel', { defaultValue: 'Practice' })}
          </div>
          <div style={{ padding: '4px 8px', flexShrink: 0 }}>
            <Input
              onClick={e => e.stopPropagation()}
              placeholder={t('searchByPractice', { defaultValue: 'Search practice' })}
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
                onClick={() => dispatch(setSelectOrDeselectAllPractices(true))}
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
                onClick={() => dispatch(setSelectOrDeselectAllPractices(false))}
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
            {filteredPractices.length === 0 ? (
              <Typography.Text style={{ fontSize: '11px', color: colors.headerText, padding: '4px 8px', display: 'block' }}>
                {t('noPractices', { defaultValue: 'No practices found' })}
              </Typography.Text>
            ) : (
              filteredPractices.map(practice => (
                <div key={practice.id} style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Checkbox
                    onClick={e => e.stopPropagation()}
                    checked={practice.selected}
                    onChange={e => dispatch(setSelectOrDeselectPractice({ id: practice.id!, selected: e.target.checked }))}
                  >
                    <span style={{ fontSize: '14px' }}>
                      {practice.id === NO_PRACTICE_FILTER_ID ? noPracticeLabel : practice.name}
                    </span>
                  </Checkbox>
                  {practice.selected && <CheckCircleFilled style={{ color: colors.successColor, fontSize: '10px' }} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    >
      <Button
        loading={loadingPractices}
        disabled={disabled || loadingPractices}
        size="small"
        style={{ fontSize: 12, borderRadius: 7 }}
      >
        {`${t('practiceFilterLabel', { defaultValue: 'Practice' })} (${selectedCount})`}
        {!loadingPractices && <CaretDownFilled style={{ fontSize: 10, marginLeft: 4 }} />}
      </Button>
    </Dropdown>
  );
};

export default Practice;
