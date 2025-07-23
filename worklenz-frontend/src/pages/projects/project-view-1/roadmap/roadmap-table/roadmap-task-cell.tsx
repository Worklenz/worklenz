import { Flex, Typography, Button, Tooltip } from '@/shared/antd-imports';
import {
  DoubleRightOutlined,
  DownOutlined,
  RightOutlined,
  ExpandAltOutlined,
} from '@/shared/antd-imports';
import { NewTaskType, toggleTaskExpansion } from '@features/roadmap/roadmap-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleTaskDrawer } from '@features/tasks/taskSlice';
import { colors } from '@/styles/colors';

type RoadmapTaskCellProps = {
  task: NewTaskType;
  isSubtask?: boolean;
};

const RoadmapTaskCell = ({ task, isSubtask = false }: RoadmapTaskCellProps) => {
  const dispatch = useAppDispatch();

  // render the toggle arrow icon for tasks with subtasks
  const renderToggleButtonForHasSubTasks = (id: string, hasSubtasks: boolean) => {
    if (!hasSubtasks) return null;
    return (
      <button
        onClick={() => dispatch(toggleTaskExpansion(id))}
        className="hover flex h-4 w-4 items-center justify-center rounded-sm text-[12px] hover:border hover:border-[#5587f5] hover:bg-[#d0eefa54]"
      >
        {task.isExpanded ? <DownOutlined /> : <RightOutlined />}
      </button>
    );
  };

  // show expand button on hover for tasks without subtasks
  const renderToggleButtonForNonSubtasks = (id: string, isSubtask: boolean) => {
    return !isSubtask ? (
      <button
        onClick={() => dispatch(toggleTaskExpansion(id))}
        className="hover flex h-4 w-4 items-center justify-center rounded-sm text-[12px] hover:border hover:border-[#5587f5] hover:bg-[#d0eefa54]"
      >
        {task.isExpanded ? <DownOutlined /> : <RightOutlined />}
      </button>
    ) : (
      <div className="h-4 w-4"></div>
    );
  };

  // render the double arrow icon and count label for tasks with subtasks
  const renderSubtasksCountLabel = (id: string, isSubtask: boolean, subTasksCount: number) => {
    return (
      !isSubtask && (
        <Button
          onClick={() => dispatch(toggleTaskExpansion(id))}
          size="small"
          style={{
            display: 'flex',
            gap: 2,
            paddingInline: 4,
            alignItems: 'center',
            justifyItems: 'center',
            border: 'none',
          }}
        >
          <Typography.Text style={{ fontSize: 12, lineHeight: 1 }}>{subTasksCount}</Typography.Text>
          <DoubleRightOutlined style={{ fontSize: 10 }} />
        </Button>
      )
    );
  };

  return (
    <Flex gap={8} align="center" justify="space-between">
      <Flex gap={8} align="center">
        {!!task?.subTasks?.length ? (
          renderToggleButtonForHasSubTasks(task.id, !!task?.subTasks?.length)
        ) : (
          <div className="h-4 w-4 opacity-0 group-hover:opacity-100 group-focus:opacity-100">
            {renderToggleButtonForNonSubtasks(task.id, isSubtask)}
          </div>
        )}

        {isSubtask && <DoubleRightOutlined style={{ fontSize: 12 }} />}

        <Tooltip title={task.name}>
          <Typography.Text ellipsis={{ expanded: false }} style={{ maxWidth: 100 }}>
            {task.name}
          </Typography.Text>
        </Tooltip>

        {renderSubtasksCountLabel(task.id, isSubtask, task?.subTasks?.length || 0)}
      </Flex>

      <Button
        type="text"
        icon={<ExpandAltOutlined />}
        onClick={() => {
          dispatch(toggleTaskDrawer());
        }}
        style={{
          backgroundColor: colors.transparent,
          padding: 0,
          height: 'fit-content',
        }}
        className="hidden group-hover:block group-focus:block"
      >
        Open
      </Button>
    </Flex>
  );
};

export default RoadmapTaskCell;
