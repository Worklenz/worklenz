import Flex from 'antd/es/flex';

import Avatars from '@/components/avatars/avatars';
import AssigneeSelector from '@/components/taskListCommon/assignee-selector/assignee-selector';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

type TaskListMembersCellProps = {
  groupId: string;
  task: IProjectTask;
};

const TaskListMembersCell = ({ groupId, task }: TaskListMembersCellProps) => {
  return (
    <Flex gap={4} align="center" onClick={() => {}}>
      <Avatars members={task.assignees || []} />
      <AssigneeSelector task={task} groupId={groupId} />
    </Flex>
  );
};

export default TaskListMembersCell;
