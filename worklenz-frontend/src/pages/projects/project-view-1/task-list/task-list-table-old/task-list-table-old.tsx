import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Checkbox,
  DatePicker,
  Flex,
  Tag,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { columnList } from '@/pages/projects/project-view-1/taskList/taskListTable/columns/columnList';
import AddTaskListRow from '@/pages/projects/project-view-1/taskList/taskListTable/taskListTableRows/AddTaskListRow';

import CustomAvatar from '@/components/CustomAvatar';
import LabelsSelector from '@components/task-list-common/labelsSelector/labels-selector';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import StatusDropdown from '@/components/task-list-common/status-dropdown/status-dropdown';
import PriorityDropdown from '@/components/task-list-common/priorityDropdown/priority-dropdown';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { durationDateFormat } from '@/utils/durationDateFormat';
import CustomColorLabel from '@components/task-list-common/labelsSelector/custom-color-label';
import CustomNumberLabel from '@components/task-list-common/labelsSelector/custom-number-label';
import PhaseDropdown from '@components/task-list-common/phaseDropdown/PhaseDropdown';
import AssigneeSelector from '@components/task-list-common/assigneeSelector/AssigneeSelector';
import TaskCell from '@/pages/projects/project-view-1/taskList/taskListTable/taskListTableCells/TaskCell';
import AddSubTaskListRow from '@/pages/projects/project-view-1/taskList/taskListTable/taskListTableRows/AddSubTaskListRow';
import { colors } from '@/styles/colors';
import TimeTracker from '@/pages/projects/project-view-1/taskList/taskListTable/taskListTableCells/TimeTracker';
import TaskContextMenu from '@/pages/projects/project-view-1/taskList/taskListTable/contextMenu/TaskContextMenu';
import TaskProgress from '@/pages/projects/project-view-1/taskList/taskListTable/taskListTableCells/TaskProgress';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import Avatars from '@/components/avatars/avatars';

const TaskListTable = ({
  taskList,
  tableId,
}: {
  taskList: ITaskListGroup;
  tableId: string | undefined;
}) => {
  // these states manage the necessary states
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(false);
  // context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  // state to check scroll
  const [scrollingTables, setScrollingTables] = useState<{
    [key: string]: boolean;
  }>({});

  // localization
  const { t } = useTranslation('task-list-table');

  const dispatch = useAppDispatch();

  // get data theme data from redux
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // get the selected project details
  const selectedProject = useSelectedProject();

  // get columns list details
  const columnsVisibility = useAppSelector(
    state => state.projectViewTaskListColumnsReducer.columnsVisibility
  );
  const visibleColumns = columnList.filter(
    column => columnsVisibility[column.key as keyof typeof columnsVisibility]
  );

  // toggle subtasks visibility
  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  // toggle all task select  when header checkbox click
  const toggleSelectAll = () => {
    if (isSelectAll) {
      setSelectedRows([]);
      dispatch(deselectAll());
    } else {
      //   const allTaskIds =
      //     task-list?.flatMap((task) => [
      //       task.taskId,
      //       ...(task.subTasks?.map((subtask) => subtask.taskId) || []),
      //     ]) || [];
      //   setSelectedRows(allTaskIds);
      //   dispatch(selectTaskIds(allTaskIds));
      //   console.log('selected tasks and subtasks (all):', allTaskIds);
    }
    setIsSelectAll(!isSelectAll);
  };

  // toggle selected row
  const toggleRowSelection = (task: IProjectTask) => {
    setSelectedRows(prevSelectedRows =>
      prevSelectedRows.includes(task.id || '')
        ? prevSelectedRows.filter(id => id !== task.id)
        : [...prevSelectedRows, task.id || '']
    );
  };

  // this use effect for realtime update the selected rows
  useEffect(() => {
    console.log('Selected tasks and subtasks:', selectedRows);
  }, [selectedRows]);

  // select one row this triggers only in handle the context menu ==> righ click mouse event
  const selectOneRow = (task: IProjectTask) => {
    setSelectedRows([task.id || '']);

    // log the task object when selected
    if (!selectedRows.includes(task.id || '')) {
      console.log('Selected task:', task);
    }
  };

  // handle custom task context menu
  const handleContextMenu = (e: React.MouseEvent, task: IProjectTask) => {
    e.preventDefault();
    setSelectedTaskId(task.id || '');
    selectOneRow(task);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  // trigger the table scrolling
  useEffect(() => {
    const tableContainer = document.querySelector(`.tasklist-container-${tableId}`);
    const handleScroll = () => {
      if (tableContainer) {
        setScrollingTables(prev => ({
          ...prev,
          [tableId]: tableContainer.scrollLeft > 0,
        }));
      }
    };
    tableContainer?.addEventListener('scroll', handleScroll);
    return () => tableContainer?.removeEventListener('scroll', handleScroll);
  }, [tableId]);

  // layout styles for table and the columns
  const customBorderColor = themeMode === 'dark' && ' border-[#303030]';

  const customHeaderColumnStyles = (key: string) =>
    `border px-2 text-left ${key === 'selector' && 'sticky left-0 z-10'} ${key === 'task' && `sticky left-[33px] z-10 after:content after:absolute after:top-0 after:-right-1 after:-z-10  after:h-[42px] after:w-1.5 after:bg-transparent ${scrollingTables[tableId] ? 'after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`} ${themeMode === 'dark' ? 'bg-[#1d1d1d] border-[#303030]' : 'bg-[#fafafa]'}`;

  const customBodyColumnStyles = (key: string) =>
    `border px-2 ${key === 'selector' && 'sticky left-0 z-10'} ${key === 'task' && `sticky left-[33px] z-10 after:content after:absolute after:top-0 after:-right-1 after:-z-10  after:min-h-[40px] after:w-1.5 after:bg-transparent ${scrollingTables[tableId] ? 'after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent' : ''}`} ${themeMode === 'dark' ? 'bg-[#141414] border-[#303030]' : 'bg-white'}`;

  // function to render the column content based on column key
  const renderColumnContent = (
    columnKey: string,
    task: IProjectTask,
    isSubtask: boolean = false
  ) => {
    switch (columnKey) {
      // task ID column
      case 'taskId':
        return (
          <Tooltip title={task.task_key || ''} className="flex justify-center">
            <Tag>{task.task_key || ''}</Tag>
          </Tooltip>
        );

      // task name column
      case 'task':
        return (
          // custom task cell component
          <TaskCell
            task={task}
            isSubTask={isSubtask}
            expandedTasks={expandedTasks}
            hoverRow={hoverRow}
            setSelectedTaskId={setSelectedTaskId}
            toggleTaskExpansion={toggleTaskExpansion}
          />
        );

      // description column
      case 'description':
        return <Typography.Text style={{ width: 200 }}></Typography.Text>;

      // progress column
      case 'progress': {
        return task?.progress || task?.progress === 0 ? (
          <TaskProgress progress={task?.progress} numberOfSubTasks={task?.sub_tasks?.length || 0} />
        ) : (
          <div></div>
        );
      }

      // members column
      case 'members':
        return (
          <Flex gap={4} align="center">
            <Avatars members={task.names || []} />
            {/* <Avatar.Group>
              {task.assignees?.map(member => (
                <CustomAvatar key={member.id} avatarName={member.name} size={26} />
              ))}
            </Avatar.Group> */}
            <AssigneeSelector taskId={selectedTaskId || '0'} />
          </Flex>
        );

      // labels column
      case 'labels':
        return (
          <Flex>
            {task?.labels && task?.labels?.length <= 2 ? (
              task?.labels?.map(label => <CustomColorLabel label={label} />)
            ) : (
              <Flex>
                <CustomColorLabel label={task?.labels ? task.labels[0] : null} />
                <CustomColorLabel label={task?.labels ? task.labels[1] : null} />
                {/* this component show other label names  */}
                <CustomNumberLabel
                  // this label list get the labels without 1, 2 elements
                  labelList={task?.labels ? task.labels : null}
                />
              </Flex>
            )}
            <LabelsSelector taskId={task.id} />
          </Flex>
        );

      // phase column
      case 'phases':
        return <PhaseDropdown projectId={selectedProject?.id || ''} />;

      // status column
      case 'status':
        return <StatusDropdown currentStatus={task.status || ''} />;

      // priority column
      case 'priority':
        return <PriorityDropdown currentPriority={task.priority || ''} />;

      // time tracking column
      case 'timeTracking':
        return <TimeTracker taskId={task.id} initialTime={task.timer_start_time || 0} />;

      // estimation column
      case 'estimation':
        return <Typography.Text>0h 0m</Typography.Text>;

      // start date column
      case 'startDate':
        return task.start_date ? (
          <Typography.Text>{simpleDateFormat(task.start_date)}</Typography.Text>
        ) : (
          <DatePicker
            placeholder="Set a start date"
            suffixIcon={null}
            style={{ border: 'none', width: '100%', height: '100%' }}
          />
        );

      // due date column
      case 'dueDate':
        return task.end_date ? (
          <Typography.Text>{simpleDateFormat(task.end_date)}</Typography.Text>
        ) : (
          <DatePicker
            placeholder="Set a due date"
            suffixIcon={null}
            style={{ border: 'none', width: '100%', height: '100%' }}
          />
        );

      // completed date column
      case 'completedDate':
        return <Typography.Text>{durationDateFormat(task.completed_at || null)}</Typography.Text>;

      // created date column
      case 'createdDate':
        return <Typography.Text>{durationDateFormat(task.created_at || null)}</Typography.Text>;

      // last updated column
      case 'lastUpdated':
        return <Typography.Text>{durationDateFormat(task.updated_at || null)}</Typography.Text>;

      // recorder column
      case 'reporter':
        return <Typography.Text>{task.reporter}</Typography.Text>;

      // default case for unsupported columns
      default:
        return null;
    }
  };

  return (
    <div className={`border-x border-b ${customBorderColor}`}>
      <div className={`tasklist-container-${tableId} min-h-0 max-w-full overflow-x-auto`}>
        <table className={`rounded-2 w-full min-w-max border-collapse`}>
          <thead className="h-[42px]">
            <tr>
              {/* this cell render the select all task checkbox  */}
              <th
                key={'selector'}
                className={`${customHeaderColumnStyles('selector')}`}
                style={{ width: 20, fontWeight: 500 }}
              >
                <Checkbox checked={isSelectAll} onChange={toggleSelectAll} />
              </th>
              {/* other header cells  */}
              {visibleColumns.map(column => (
                <th
                  key={column.key}
                  className={`${customHeaderColumnStyles(column.key)}`}
                  style={{ width: column.width, fontWeight: 500 }}
                >
                  {column.key === 'phases'
                    ? column.columnHeader
                    : t(`${column.columnHeader}Column`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {taskList?.tasks?.map(task => (
              <React.Fragment key={task.id}>
                <tr
                  key={task.id}
                  onContextMenu={e => handleContextMenu(e, task)}
                  className={`${taskList.tasks.length === 0 ? 'h-0' : 'h-[42px]'}`}
                >
                  {/* this cell render the select the related task checkbox  */}
                  <td
                    key={'selector'}
                    className={customBodyColumnStyles('selector')}
                    style={{
                      width: 20,
                      backgroundColor: selectedRows.includes(task.id || '')
                        ? themeMode === 'dark'
                          ? colors.skyBlue
                          : '#dceeff'
                        : hoverRow === task.id
                          ? themeMode === 'dark'
                            ? '#000'
                            : '#f8f7f9'
                          : themeMode === 'dark'
                            ? '#181818'
                            : '#fff',
                    }}
                  >
                    <Checkbox
                      checked={selectedRows.includes(task.id || '')}
                      onChange={() => toggleRowSelection(task)}
                    />
                  </td>
                  {/* other cells  */}
                  {visibleColumns.map(column => (
                    <td
                      key={column.key}
                      className={customBodyColumnStyles(column.key)}
                      style={{
                        width: column.width,
                        backgroundColor: selectedRows.includes(task.id || '')
                          ? themeMode === 'dark'
                            ? '#000'
                            : '#dceeff'
                          : hoverRow === task.id
                            ? themeMode === 'dark'
                              ? '#000'
                              : '#f8f7f9'
                            : themeMode === 'dark'
                              ? '#181818'
                              : '#fff',
                      }}
                    >
                      {renderColumnContent(column.key, task)}
                    </td>
                  ))}
                </tr>

                {/* this is for sub tasks  */}
                {expandedTasks.includes(task.id || '') &&
                  task?.sub_tasks?.map(subtask => (
                    <tr
                      key={subtask.id}
                      onContextMenu={e => handleContextMenu(e, subtask)}
                      className={`${taskList.tasks.length === 0 ? 'h-0' : 'h-[42px]'}`}
                    >
                      {/* this cell render the select the related task checkbox  */}
                      <td
                        key={'selector'}
                        className={customBodyColumnStyles('selector')}
                        style={{
                          width: 20,
                          backgroundColor: selectedRows.includes(subtask.id || '')
                            ? themeMode === 'dark'
                              ? colors.skyBlue
                              : '#dceeff'
                            : hoverRow === subtask.id
                              ? themeMode === 'dark'
                                ? '#000'
                                : '#f8f7f9'
                              : themeMode === 'dark'
                                ? '#181818'
                                : '#fff',
                        }}
                      >
                        <Checkbox
                          checked={selectedRows.includes(subtask.id || '')}
                          onChange={() => toggleRowSelection(subtask)}
                        />
                      </td>

                      {/* other sub tasks cells  */}
                      {visibleColumns.map(column => (
                        <td
                          key={column.key}
                          className={customBodyColumnStyles(column.key)}
                          style={{
                            width: column.width,
                            backgroundColor: selectedRows.includes(subtask.id || '')
                              ? themeMode === 'dark'
                                ? '#000'
                                : '#dceeff'
                              : hoverRow === subtask.id || ''
                                ? themeMode === 'dark'
                                  ? '#000'
                                  : '#f8f7f9'
                                : themeMode === 'dark'
                                  ? '#181818'
                                  : '#fff',
                          }}
                        >
                          {renderColumnContent(column.key, subtask, true)}
                        </td>
                      ))}
                    </tr>
                  ))}

                {expandedTasks.includes(task.id || '') && (
                  <tr>
                    <td colSpan={visibleColumns.length}>
                      <AddSubTaskListRow />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* add a main task to the table  */}
      <AddTaskListRow />

      {/* custom task context menu  */}
      <TaskContextMenu
        visible={contextMenuVisible}
        position={contextMenuPosition}
        selectedTask={selectedRows[0]}
        onClose={() => setContextMenuVisible(false)}
      />
    </div>
  );
};

export default TaskListTable;
