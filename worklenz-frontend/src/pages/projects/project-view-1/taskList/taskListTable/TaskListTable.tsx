import { useAppSelector } from '@/hooks/useAppSelector';
import { columnList } from './columns/columnList';
import AddTaskListRow from './taskListTableRows/AddTaskListRow';
import { Checkbox, Flex, Tag, Tooltip } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import TaskCell from './taskListTableCells/TaskCell';
import AddSubTaskListRow from './taskListTableRows/AddSubTaskListRow';
import { colors } from '@/styles/colors';
import TaskContextMenu from './contextMenu/TaskContextMenu';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { deselectAll } from '@features/projects/bulkActions/bulkActionSlice';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { HolderOutlined } from '@/shared/antd-imports';

const TaskListTable = ({
  taskList,
  tableId,
}: {
  taskList: IProjectTask[] | null;
  tableId: string;
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
    state => state.projectViewTaskListColumnsReducer.columnList
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
      const allTaskIds =
        taskList?.flatMap(task => [
          task.id,
          ...(task.sub_tasks?.map(subtask => subtask.id) || []),
        ]) || [];

      // setSelectedRows(allTaskIds);
      // dispatch(selectTaskIds(allTaskIds));
      // console.log('selected tasks and subtasks (all):', allTaskIds);
    }
    setIsSelectAll(!isSelectAll);
  };

  // toggle selected row
  const toggleRowSelection = (task: IProjectTask) => {
    setSelectedRows(prevSelectedRows =>
      prevSelectedRows.includes(task.id || '')
        ? prevSelectedRows.filter(id => id !== task.id || '')
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
          <Tooltip title={task.id} className="flex justify-center">
            <Tag>{task.task_key}</Tag>
          </Tooltip>
        );

      // task column
      case 'task':
        return (
          // custom task cell component
          <TaskCell
            task={task}
            isSubTask={isSubtask}
            expandedTasks={expandedTasks}
            setSelectedTaskId={setSelectedTaskId}
            toggleTaskExpansion={toggleTaskExpansion}
          />
        );

      // description column
      case 'description':
        return (
          <div style={{ width: 260 }}>
            {/* <Typography.Paragraph ellipsis={{ expandable: false }} style={{ marginBlockEnd: 0 }} >
              {task.description || ''}
            </Typography.Paragraph> */}
          </div>
        );

      // progress column
      case 'progress': {
        return <div></div>;
      }

      // members column
      case 'members':
        return <div></div>;

      // labels column
      case 'labels':
        return <div></div>;

      // phase column
      case 'phases':
        return <div></div>;

      // status column
      case 'status':
        return <div></div>;

      // priority column
      case 'priority':
        return <div></div>;

      // // time tracking column
      // case 'timeTracking':
      //   return (
      //     <TimeTracker
      //       taskId={task.id}
      //       initialTime={task.timer_start_time || 0}
      //     />
      //   );

      // estimation column
      case 'estimation':
        return <div></div>;

      // start date column
      case 'startDate':
        return <div></div>;

      // due date column
      case 'dueDate':
        return <div></div>;

      // completed date column
      case 'completedDate':
        return <div></div>;

      // created date column
      case 'createdDate':
        return <div></div>;

      // last updated column
      case 'lastUpdated':
        return <div></div>;

      // recorder column
      case 'reporter':
        return <div></div>;

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
                style={{ width: 56, fontWeight: 500 }}
              >
                <Flex justify="flex-end">
                  <Checkbox checked={isSelectAll} onChange={toggleSelectAll} />
                </Flex>
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
            {taskList?.map(task => (
              <React.Fragment key={task.id}>
                <tr
                  key={task.id}
                  onContextMenu={e => handleContextMenu(e, task)}
                  className={`${taskList.length === 0 ? 'h-0' : 'h-[42px]'}`}
                >
                  {/* this cell render the select the related task checkbox  */}
                  <td
                    key={'selector'}
                    className={customBodyColumnStyles('selector')}
                    style={{
                      width: 56,
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
                    <Flex gap={8} align="center">
                      <HolderOutlined />
                      <Checkbox
                        checked={selectedRows.includes(task.id || '')}
                        onChange={() => toggleRowSelection(task)}
                      />
                    </Flex>
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
                      onMouseEnter={() => setHoverRow(subtask.id || '')}
                      onMouseLeave={() => setHoverRow(null)}
                      className={`${taskList.length === 0 ? 'h-0' : 'h-[42px]'}`}
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
                              : hoverRow === subtask.id
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
