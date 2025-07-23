import { CaretDownFilled } from '@/shared/antd-imports';
import { Badge, Button, Card, Checkbox, Dropdown, List, Space } from '@/shared/antd-imports';
import { useState } from 'react';

import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { useAppSelector } from '@/hooks/useAppSelector';

const PriorityFilterDropdown = (props: { priorities: ITaskPriority[] }) => {
  const [selectedCount, setSelectedCount] = useState<number>(0);

  // localization
  const { t } = useTranslation('task-list-filters');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // handle selected filters count
  const handleSelectedFiltersCount = (checked: boolean) => {
    setSelectedCount(prev => (checked ? prev + 1 : prev - 1));
  };

  // custom dropdown content
  const priorityDropdownContent = (
    <Card className="custom-card" style={{ width: 120 }} styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0 }}>
        {props.priorities?.map(item => (
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={item.id}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Space>
              <Checkbox id={item.id} onChange={e => handleSelectedFiltersCount(e.target.checked)} />
              <Badge color={item.color_code} />
              {item.name}
            </Space>
          </List.Item>
        ))}
      </List>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => priorityDropdownContent}
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
          {t('priorityText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default PriorityFilterDropdown;
