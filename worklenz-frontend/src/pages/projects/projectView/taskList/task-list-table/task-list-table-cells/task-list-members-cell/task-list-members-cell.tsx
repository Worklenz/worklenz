import Flex from 'antd/es/flex';

import Avatars from '@/components/avatars/avatars';
import AssigneeSelector from '@/components/taskListCommon/assignee-selector/assignee-selector';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';

type TaskListMembersCellProps = {
  groupId: string;
  task: IProjectTask;
};

const TaskListMembersCell = ({ groupId, task }: TaskListMembersCellProps) => {
  const { canCreateTask } = useTaskCreationPermission();

  return (
    <Flex gap={4} align="center" onClick={() => {}}>
      <Avatars members={task.assignees || []} />
      {canCreateTask && <AssigneeSelector task={task} groupId={groupId} />}
    </Flex>
  );
};

export default TaskListMembersCell;
