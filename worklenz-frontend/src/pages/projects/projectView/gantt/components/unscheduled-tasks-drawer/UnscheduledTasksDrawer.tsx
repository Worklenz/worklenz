import React from 'react';
import { Drawer, Empty, Typography, List } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { RoadmapTasksResponse } from '../../services/roadmap-api.service';

interface UnscheduledTasksDrawerProps {
  open: boolean;
  tasks: RoadmapTasksResponse[];
  onClose: () => void;
  onTaskAdd: (task: RoadmapTasksResponse) => void;
}

const UnscheduledTasksDrawer: React.FC<UnscheduledTasksDrawerProps> = ({
  open,
  tasks,
  onClose,
  onTaskAdd,
}) => {
  const { t } = useTranslation('gantt');

  return (
    <Drawer
      title={t('toolbar.noDate', { defaultValue: 'No Date' })}
      open={open}
      onClose={onClose}
      width={420}
      destroyOnClose={false}
      bodyStyle={{ paddingBottom: 24 }}
      zIndex={1000}
    >
      <div className="p-4">
        <Typography.Title level={5} className="mb-4">
          {t('unscheduledTasksTitle', { defaultValue: 'Unscheduled tasks' })}
        </Typography.Title>

        {tasks.length === 0 ? (
          <Empty
            description={t('noUnscheduledTasks', {
              defaultValue: 'No unscheduled tasks available.',
            })}
          />
        ) : (
          <List
            dataSource={tasks}
            rowKey={task => task.id}
            renderItem={task => (
              <List.Item className="mb-2 px-0 bg-transparent">
                <div
                  className="w-full rounded-lg px-3 py-3 bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                  onClick={() => onTaskAdd(task)}
                >
                  <div className="font-medium">{task.name}</div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </Drawer>
  );
};

export default UnscheduledTasksDrawer;
