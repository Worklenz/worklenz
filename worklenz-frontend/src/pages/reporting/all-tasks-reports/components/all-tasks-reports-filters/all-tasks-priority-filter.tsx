import { memo, useEffect } from 'react';
import { Button, Card, Checkbox, Dropdown, Flex, Typography, Tag } from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import {
  setSelectedPriorities,
  togglePriority,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksPriorityFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { selectedPriorities } = useAppSelector(state => state.allTasksReportsReducer);
  const { priorities } = useAppSelector(state => state.priorityReducer);

  useEffect(() => {
    if (!priorities.length) {
      dispatch(fetchPriorities());
    }
  }, [dispatch, priorities.length]);

  const handleToggle = (priorityId: string) => {
    dispatch(togglePriority(priorityId));
    dispatch(fetchAllTasks());
  };

  const handleClearAll = () => {
    dispatch(setSelectedPriorities([]));
    dispatch(fetchAllTasks());
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 220 } }}>
      <Flex vertical gap={8}>
        <Flex justify="flex-end">
          <Button type="link" size="small" onClick={handleClearAll}>
            {t('clearAll', { defaultValue: 'Clear All' })}
          </Button>
        </Flex>
        <Flex vertical gap={4}>
          {priorities.map(priority => (
            <Checkbox
              key={priority.id}
              checked={selectedPriorities.includes(priority.id || '')}
              onChange={() => handleToggle(priority.id || '')}
            >
              <Tag color={priority.color_code} style={{ margin: 0 }}>
                {priority.name}
              </Tag>
            </Checkbox>
          ))}
        </Flex>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t('priorityFilter', { defaultValue: 'Priority' })}
          {selectedPriorities.length > 0 && (
            <Typography.Text type="secondary">({selectedPriorities.length})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksPriorityFilter);
