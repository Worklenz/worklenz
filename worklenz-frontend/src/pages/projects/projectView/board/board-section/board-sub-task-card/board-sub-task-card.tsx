import { useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { Col, Flex, Typography, List } from 'antd';
import CustomAvatarGroup from '@/components/board/custom-avatar-group';
import CustomDueDatePicker from '@/components/board/custom-due-date-picker';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';

interface IBoardSubTaskCardProps {
  subtask: IProjectTask;
  sectionId: string;
}

const BoardSubTaskCard = ({ subtask, sectionId }: IBoardSubTaskCardProps) => {
  const dispatch = useAppDispatch();
  const [subtaskDueDate, setSubtaskDueDate] = useState<Dayjs | null>(
    subtask?.end_date ? dayjs(subtask?.end_date) : null
  );

  const handleCardClick = (e: React.MouseEvent, id: string) => {
    // Prevent the event from propagating to parent elements
    e.stopPropagation();

    // Add a small delay to ensure it's a click and not the start of a drag
    const clickTimeout = setTimeout(() => {
      dispatch(setSelectedTaskId(id));
      dispatch(setShowTaskDrawer(true));
    }, 50);

    return () => clearTimeout(clickTimeout);
  };

  return (
    <List.Item
      key={subtask.id}
      className="group"
      style={{
        width: '100%',
      }}
      onClick={e => handleCardClick(e, subtask.id || '')}
    >
      <Col span={10}>
        <Typography.Text
          style={{ fontWeight: 500, fontSize: 14 }}
          delete={subtask.status === 'done'}
          ellipsis={{ expanded: false }}
        >
          {subtask.name}
        </Typography.Text>
      </Col>

      <Flex gap={8} justify="end" style={{ width: '100%' }}>
        <CustomAvatarGroup task={subtask} sectionId={sectionId} />

        <CustomDueDatePicker task={subtask} onDateChange={setSubtaskDueDate} />
      </Flex>
    </List.Item>
  );
};

export default BoardSubTaskCard;
