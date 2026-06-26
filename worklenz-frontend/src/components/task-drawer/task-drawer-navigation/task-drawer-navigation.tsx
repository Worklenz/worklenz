import { DownOutlined, LeftOutlined, RightOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

interface TaskDrawerNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalTasks: number;
}

const TaskDrawerNavigation = ({
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  currentIndex,
  totalTasks,
}: TaskDrawerNavigationProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <Flex gap={4} align="center">
      <Tooltip title={t('taskHeader.previousTask')} placement="bottom">
        <Button
          type="text"
          size="small"
          icon={<UpOutlined />}
          onClick={onPrevious}
          disabled={!hasPrevious}
          style={{
            color: themeMode === 'dark' ? '#fff' : '#000',
            opacity: hasPrevious ? 1 : 0.3,
          }}
        />
      </Tooltip>

      <Tooltip title={t('taskHeader.nextTask')} placement="bottom">
        <Button
          type="text"
          size="small"
          icon={<DownOutlined />}
          onClick={onNext}
          disabled={!hasNext}
          style={{
            color: themeMode === 'dark' ? '#fff' : '#000',
            opacity: hasNext ? 1 : 0.3,
          }}
        />
      </Tooltip>
      <span
        style={{
          fontSize: '12px',
          color: themeMode === 'dark' ? '#999' : '#666',
          minWidth: '40px',
          textAlign: 'center',
        }}
      >
        {currentIndex + 1} / {totalTasks}
      </span>
    </Flex>
  );
};

export default TaskDrawerNavigation;
