import {
  CaretDownFilled,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@/shared/antd-imports';
import { Badge, Button, Card, Checkbox, Dropdown, List, Space } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { colors } from '../../../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

const SortFilterDropdown = () => {
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [sortState, setSortState] = useState<Record<string, 'ascending' | 'descending'>>({});

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // localization
  const { t } = useTranslation('task-list-filters');

  // handle selected filters count
  const handleSelectedFiltersCount = (checked: boolean) => {
    setSelectedCount(prev => (checked ? prev + 1 : prev - 1));
  };

  // fuction for handle sort
  const handleSort = (key: string) => {
    setSortState(prev => ({
      ...prev,
      [key]: prev[key] === 'ascending' ? 'descending' : 'ascending',
    }));
  };

  // sort dropdown items
  type SortFieldsType = {
    key: string;
    label: string;
  };

  const sortFieldsList: SortFieldsType[] = [
    { key: 'task', label: t('taskText') },
    { key: 'status', label: t('statusText') },
    { key: 'priority', label: t('priorityText') },
    { key: 'startDate', label: t('startDateText') },
    { key: 'endDate', label: t('endDateText') },
    { key: 'completedDate', label: t('completedDateText') },
    { key: 'createdDate', label: t('createdDateText') },
    { key: 'lastUpdated', label: t('lastUpdatedText') },
  ];

  // custom dropdown content
  const sortDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0 }}>
        {sortFieldsList.map(item => (
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={item.key}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
            }}
          >
            <Space>
              <Checkbox
                id={item.key}
                onChange={e => handleSelectedFiltersCount(e.target.checked)}
              />
              {item.label}
            </Space>
            <Button
              onClick={() => handleSort(item.key)}
              icon={
                sortState[item.key] === 'ascending' ? (
                  <SortAscendingOutlined />
                ) : (
                  <SortDescendingOutlined />
                )
              }
            />
          </List.Item>
        ))}
      </List>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => sortDropdownContent}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        style={{
          backgroundColor: selectedCount > 0 ? colors.paleBlue : colors.transparent,

          color: selectedCount > 0 ? colors.darkGray : 'inherit',
        }}
      >
        <Space>
          <SortAscendingOutlined />
          {t('sortText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default SortFilterDropdown;
