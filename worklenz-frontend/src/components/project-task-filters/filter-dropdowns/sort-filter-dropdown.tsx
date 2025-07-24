import { CaretDownFilled, SortAscendingOutlined, SortDescendingOutlined } from '@/shared/antd-imports';

import Badge from 'antd/es/badge';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Checkbox from 'antd/es/checkbox';
import Dropdown from 'antd/es/dropdown';
import List from 'antd/es/list';
import Space from 'antd/es/space';

import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskListSortableColumn } from '@/types/tasks/taskListFilters.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setFields } from '@/features/tasks/tasks.slice';

enum SORT_ORDER {
  ASCEND = 'ascend',
  DESCEND = 'descend',
}

const SortFilterDropdown = () => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { fields } = useAppSelector(state => state.taskReducer);

  const handleSelectedFiltersCount = (item: ITaskListSortableColumn) => {
    if (!item.key) return;
    let newFields = [...fields];
    if (newFields.some(field => field.key === item.key)) {
      newFields.splice(newFields.indexOf(item), 1);
    } else {
      newFields.push(item);
    }
    dispatch(setFields(newFields));
  };

  const handleSortChange = (key: string) => {
    if (!key) return;
    let newFields = [...fields];

    newFields = newFields.map(item => {
      if (item.key === key) {
        return {
          ...item,
          sort_order:
            item.sort_order === SORT_ORDER.ASCEND ? SORT_ORDER.DESCEND : SORT_ORDER.ASCEND,
        };
      }
      return item;
    });
    dispatch(setFields(newFields));
  };

  const sortFieldsList: ITaskListSortableColumn[] = [
    { label: t('taskText'), key: 'name', sort_order: SORT_ORDER.ASCEND },
    { label: t('statusText'), key: 'status', sort_order: SORT_ORDER.ASCEND },
    { label: t('priorityText'), key: 'priority', sort_order: SORT_ORDER.ASCEND },
    { label: t('startDateText'), key: 'start_date', sort_order: SORT_ORDER.ASCEND },
    { label: t('endDateText'), key: 'end_date', sort_order: SORT_ORDER.ASCEND },
    { label: t('completedDateText'), key: 'completed_at', sort_order: SORT_ORDER.ASCEND },
    { label: t('createdDateText'), key: 'created_at', sort_order: SORT_ORDER.ASCEND },
    { label: t('lastUpdatedText'), key: 'updated_at', sort_order: SORT_ORDER.ASCEND },
  ];

  // custom dropdown content
  const sortDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0 }}>
        {sortFieldsList.map(sortField => (
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={sortField.key}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
            }}
          >
            <Space>
              <Checkbox
                id={sortField.key}
                checked={fields.some(field => field.key === sortField.key)}
                onChange={e => handleSelectedFiltersCount(sortField)}
              >
                {sortField.label}
              </Checkbox>
            </Space>
            <Button
              onClick={() => handleSortChange(sortField.key || '')}
              icon={
                sortField.sort_order === SORT_ORDER.ASCEND ? (
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
          backgroundColor:
            fields.length > 0
              ? themeMode === 'dark'
                ? '#003a5c'
                : colors.paleBlue
              : colors.transparent,

          color: fields.length > 0 ? (themeMode === 'dark' ? 'white' : colors.darkGray) : 'inherit',
        }}
      >
        <Space>
          <SortAscendingOutlined />
          {t('sortText')}
          {fields.length > 0 && <Badge size="small" count={fields.length} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default SortFilterDropdown;
