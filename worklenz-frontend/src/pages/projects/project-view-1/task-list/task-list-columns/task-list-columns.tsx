import { Avatar, Checkbox, DatePicker, Flex, Select, Tag } from '@/shared/antd-imports';
import { createColumnHelper, ColumnDef } from '@tanstack/react-table';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { HolderOutlined, PlusOutlined } from '@/shared/antd-imports';
import StatusDropdown from '@/components/task-list-common/status-dropdown/status-dropdown';
import Avatars from '@/components/avatars/avatars';
import LabelsSelector from '@/components/task-list-common/labelsSelector/labels-selector';
import CustomColorLabel from '@/components/task-list-common/labelsSelector/custom-color-label';
import TaskRowName from '@/components/task-list-common/task-row/task-row-name/task-row-name';
import TaskRowDescription from '@/components/task-list-common/task-row/task-row-description/task-row-description';
import TaskRowProgress from '@/components/task-list-common/task-row/task-row-progress/task-row-progress';
import TaskRowDueTime from '@/components/task-list-common/task-row/task-list-due-time-cell/task-row-due-time';
import { COLUMN_KEYS } from '@/features/tasks/tasks.slice';

interface CreateColumnsProps {
  expandedRows: Record<string, boolean>;
  statuses: any[];
  handleTaskSelect: (taskId: string) => void;
  getCurrentSession: () => any;
}

export const createColumns = ({
  expandedRows,
  statuses,
  handleTaskSelect,
  getCurrentSession,
}: CreateColumnsProps): ColumnDef<IProjectTask, any>[] => {
  const columnHelper = createColumnHelper<IProjectTask>();

  return [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          style={{ padding: '8px 6px 8px 0!important' }}
        />
      ),
      cell: ({ row }) => (
        <Flex align="center" gap={4}>
          <HolderOutlined style={{ cursor: 'move' }} />
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            indeterminate={row.getIsSomeSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        </Flex>
      ),
      size: 47,
      minSize: 47,
      maxSize: 47,
      enablePinning: true,
      meta: {
        style: { position: 'sticky', left: 0, zIndex: 1 },
      },
    }),
    columnHelper.accessor('task_key', {
      header: 'Key',
      id: COLUMN_KEYS.KEY,
      size: 85,
      minSize: 85,
      maxSize: 85,
      enablePinning: false,
      cell: ({ row }) => (
        <Tag onClick={() => handleTaskSelect(row.original.id || '')} style={{ cursor: 'pointer' }}>
          {row.original.task_key}
        </Tag>
      ),
    }),

    columnHelper.accessor('name', {
      header: 'Task',
      id: COLUMN_KEYS.NAME,
      size: 450,
      enablePinning: true,
      meta: {
        style: { position: 'sticky', left: '47px', zIndex: 1 },
      },
      cell: ({ row }) => (
        <TaskRowName
          task={row.original}
          isSubTask={false}
          expandedTasks={Object.keys(expandedRows)}
          setSelectedTaskId={() => {}}
          toggleTaskExpansion={() => {}}
        />
      ),
    }),

    columnHelper.accessor('description', {
      header: 'Description',
      id: COLUMN_KEYS.DESCRIPTION,
      size: 225,
      enablePinning: false,
      cell: ({ row }) => <TaskRowDescription description={row.original.description || ''} />,
    }),

    columnHelper.accessor('progress', {
      header: 'Progress',
      id: COLUMN_KEYS.PROGRESS,
      size: 80,
      enablePinning: false,
      cell: ({ row }) => (
        <TaskRowProgress
          progress={row.original.progress || 0}
          numberOfSubTasks={row.original.sub_tasks_count || 0}
        />
      ),
    }),

    columnHelper.accessor('status', {
      header: 'Status',
      id: COLUMN_KEYS.STATUS,
      size: 120,
      enablePinning: false,
      cell: ({ row }) => (
        <StatusDropdown
          key={`${row.original.id}-status`}
          statusList={statuses}
          task={row.original}
          teamId={getCurrentSession()?.team_id || ''}
          onChange={statusId => {
            console.log('Status changed:', statusId);
          }}
        />
      ),
    }),

    columnHelper.accessor('names', {
      header: 'Assignees',
      id: COLUMN_KEYS.ASSIGNEES,
      size: 159,
      enablePinning: false,
      cell: ({ row }) => (
        <Flex align="center" gap={8}>
          <Avatars
            key={`${row.original.id}-assignees`}
            members={row.original.names || []}
            maxCount={3}
          />
          <Avatar
            size={28}
            icon={<PlusOutlined />}
            className="avatar-add"
            style={{
              backgroundColor: '#ffffff',
              border: '1px dashed #c4c4c4',
              color: '#000000D9',
              cursor: 'pointer',
            }}
          />
        </Flex>
      ),
    }),

    columnHelper.accessor('end_date', {
      header: 'Due Date',
      id: COLUMN_KEYS.DUE_DATE,
      size: 149,
      enablePinning: false,
      cell: ({ row }) => (
        <span>
          <DatePicker
            key={`${row.original.id}-end-date`}
            placeholder="Set a due date"
            suffixIcon={null}
            variant="borderless"
          />
        </span>
      ),
    }),

    columnHelper.accessor('due_time', {
      header: 'Due Time',
      id: COLUMN_KEYS.DUE_TIME,
      size: 120,
      enablePinning: false,
      cell: ({ row }) => <TaskRowDueTime dueTime={row.original.due_time || ''} />,
    }),

    columnHelper.accessor('labels', {
      header: 'Labels',
      id: COLUMN_KEYS.LABELS,
      size: 225,
      enablePinning: false,
      cell: ({ row }) => (
        <Flex>
          {row.original.labels?.map(label => (
            <CustomColorLabel key={`${row.original.id}-${label.id}`} label={label} />
          ))}
          <LabelsSelector taskId={row.original.id} />
        </Flex>
      ),
    }),

    columnHelper.accessor('start_date', {
      header: 'Start Date',
      id: COLUMN_KEYS.START_DATE,
      size: 149,
      enablePinning: false,
      cell: ({ row }) => (
        <span>
          <DatePicker placeholder="Set a start date" suffixIcon={null} variant="borderless" />
        </span>
      ),
    }),

    columnHelper.accessor('priority', {
      header: 'Priority',
      id: COLUMN_KEYS.PRIORITY,
      size: 120,
      enablePinning: false,
      cell: ({ row }) => (
        <span>
          <Select
            variant="borderless"
            options={[
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </span>
      ),
    }),

    // columnHelper.accessor('time_tracking', {
    //   header: 'Time Tracking',
    //   size: 120,
    //   enablePinning: false,
    //   cell: ({ row }) => (
    //     <TaskRowTimeTracking taskId={row.original.id || null} />
    //   )
    // })
  ];
};
