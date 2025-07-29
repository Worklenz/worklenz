import React from 'react';
import { DatePicker, Typography } from '@/shared/antd-imports';
import dayjs, { Dayjs } from 'dayjs';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { NewTaskType, updateTaskDate } from '@features/roadmap/roadmap-slice';
import { colors } from '@/styles/colors';
import RoadmapTaskCell from './roadmap-task-cell';

const RoadmapTable = () => {
  // Get task list and expanded tasks from roadmap slice
  const tasks = useAppSelector(state => state.roadmapReducer.tasksList);

  // Get theme data from theme slice
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  // function to handle date changes
  const handleDateChange = (taskId: string, dateType: 'start' | 'end', date: Dayjs) => {
    const updatedDate = date.toDate();

    dispatch(
      updateTaskDate({
        taskId,
        start: dateType === 'start' ? updatedDate : new Date(),
        end: dateType === 'end' ? updatedDate : new Date(),
      })
    );
  };

  // Adjusted column type with a string or ReactNode for the title
  const columns: { key: string; title: React.ReactNode; width: number }[] = [
    {
      key: 'name',
      title: 'Task Name',
      width: 240,
    },
    {
      key: 'start',
      title: 'Start Date',
      width: 130,
    },
    {
      key: 'end',
      title: 'End Date',
      width: 130,
    },
  ];

  // Function to render the column content based on column key
  const renderColumnContent = (
    columnKey: string,
    task: NewTaskType,
    isSubtask: boolean = false
  ) => {
    switch (columnKey) {
      case 'name':
        return <RoadmapTaskCell task={task} isSubtask={isSubtask} />;
      case 'start':
        const startDayjs = task.start ? dayjs(task.start) : null;
        return (
          <DatePicker
            placeholder="Set Start Date"
            defaultValue={startDayjs}
            format={'MMM DD, YYYY'}
            suffixIcon={null}
            disabled={task.type === 'project'}
            onChange={date => handleDateChange(task.id, 'end', date)}
            style={{
              backgroundColor: colors.transparent,
              border: 'none',
              boxShadow: 'none',
            }}
          />
        );
      case 'end':
        const endDayjs = task.end ? dayjs(task.end) : null;
        return (
          <DatePicker
            placeholder="Set End Date"
            defaultValue={endDayjs}
            format={'MMM DD, YYYY'}
            suffixIcon={null}
            disabled={task.type === 'project'}
            onChange={date => handleDateChange(task.id, 'end', date)}
            style={{
              backgroundColor: colors.transparent,
              border: 'none',
              boxShadow: 'none',
            }}
          />
        );

      default:
        return null;
    }
  };

  const dataSource = tasks.map(task => ({
    id: task.id,
    name: task.name,
    start: task.start,
    end: task.end,
    type: task.type,
    progress: task.progress,
    subTasks: task.subTasks,
    isExpanded: task.isExpanded,
  }));

  // Layout styles for table and columns
  const customHeaderColumnStyles = `border px-2 h-[50px] text-left z-10 after:content after:absolute after:top-0 after:-right-1 after:-z-10 after:h-[42px] after:w-1.5 after:bg-transparent after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent ${themeMode === 'dark' ? 'bg-[#1d1d1d] border-[#303030]' : 'bg-[#fafafa]'}`;

  const customBodyColumnStyles = `border px-2 h-[50px] z-10 after:content after:absolute after:top-0 after:-right-1 after:-z-10 after:min-h-[40px] after:w-1.5 after:bg-transparent after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent ${themeMode === 'dark' ? 'bg-transparent border-[#303030]' : 'bg-transparent'}`;

  const rowBackgroundStyles =
    themeMode === 'dark' ? 'even:bg-[#1b1b1b] odd:bg-[#141414]' : 'even:bg-[#f4f4f4] odd:bg-white';

  return (
    <div className="relative w-full max-w-[1000px]">
      <table className={`rounded-2 w-full min-w-max border-collapse`}>
        <thead className="h-[50px]">
          <tr>
            {/* table header */}
            {columns.map(column => (
              <th
                key={column.key}
                className={`${customHeaderColumnStyles}`}
                style={{ width: column.width, fontWeight: 500 }}
              >
                <Typography.Text style={{ fontWeight: 500 }}>{column.title}</Typography.Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center">
                No tasks available
              </td>
            </tr>
          ) : (
            dataSource.map(task => (
              <React.Fragment key={task.id}>
                <tr
                  key={task.id}
                  className={`group cursor-pointer ${dataSource.length === 0 ? 'h-0' : 'h-[50px]'} ${rowBackgroundStyles}`}
                >
                  {columns.map(column => (
                    <td
                      key={column.key}
                      className={`${customBodyColumnStyles}`}
                      style={{
                        width: column.width,
                      }}
                    >
                      {renderColumnContent(column.key, task)}
                    </td>
                  ))}
                </tr>

                {/* subtasks */}
                {task.isExpanded &&
                  task?.subTasks?.map(subtask => (
                    <tr key={`subtask-${subtask.id}`} className={`h-[50px] ${rowBackgroundStyles}`}>
                      {columns.map(column => (
                        <td
                          key={column.key}
                          className={`${customBodyColumnStyles}`}
                          style={{
                            width: column.width,
                          }}
                        >
                          {renderColumnContent(column.key, subtask, true)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RoadmapTable;
