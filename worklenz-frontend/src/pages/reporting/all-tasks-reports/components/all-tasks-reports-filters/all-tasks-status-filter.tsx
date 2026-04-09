import { memo, useState, useEffect } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Typography,
  Spin,
  Tag,
} from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import {
  setSelectedStatuses,
  toggleStatus,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const statusCategories = [
  { key: 'todo', label: 'To Do', color: '#d9d9d9' },
  { key: 'doing', label: 'Doing', color: '#1890ff' },
  { key: 'done', label: 'Done', color: '#52c41a' },
];

const AllTasksStatusFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { selectedStatuses } = useAppSelector(state => state.allTasksReportsReducer);

  const handleToggle = (statusKey: string) => {
    dispatch(toggleStatus(statusKey));
    dispatch(fetchAllTasks());
  };

  const handleClearAll = () => {
    dispatch(setSelectedStatuses([]));
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
          {statusCategories.map(status => (
            <Checkbox
              key={status.key}
              checked={selectedStatuses.includes(status.key)}
              onChange={() => handleToggle(status.key)}
            >
              <Tag color={status.color} style={{ margin: 0 }}>
                {status.label}
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
          {t('statusFilter', { defaultValue: 'Status' })}
          {selectedStatuses.length > 0 && (
            <Typography.Text type="secondary">({selectedStatuses.length})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksStatusFilter);
