import { CaretDownFilled } from '@ant-design/icons';
import { Button, Checkbox, Divider, Dropdown, Input, theme } from 'antd';
import React, { useEffect, useState } from 'react';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { useTranslation } from 'react-i18next';
import { ISelectableTeam } from '@/types/reporting/reporting-filters.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchReportingCategories,
  fetchReportingProjects,
  fetchReportingTeams,
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectTeam,
} from '@/features/reporting/time-reports/time-reports-overview.slice';

const Team: React.FC = () => {
  const dispatch = useAppDispatch();
  const [checkedList, setCheckedList] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const { t } = useTranslation('time-report');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { token } = theme.useToken();

  const { teams, loadingTeams } = useAppSelector(state => state.timeReportsOverviewReducer);

  const filteredItems = teams.filter(item =>
    item.name?.toLowerCase().includes(searchText.toLowerCase())
  );

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
                placeholder={t('searchByName')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onClick={e => e.stopPropagation()}
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
        <Button loading={loadingTeams}>
          {t('teams')} <CaretDownFilled />
        </Button>
      </Dropdown>
    </div>
  );
};

export default Team;
