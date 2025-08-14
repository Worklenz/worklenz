import { Gantt, Task, ViewMode } from 'gantt-task-react';
import React from 'react';
import { colors } from '../../../../styles/colors';
import { useMixpanelTracking } from '../../../../hooks/useMixpanelTracking';
import { evt_roadmap_drag_change_date, evt_roadmap_drag_move } from '../../../../shared/worklenz-analytics-events';
import {
  NewTaskType,
  updateTaskDate,
  updateTaskProgress,
} from '../../../../features/roadmap/roadmap-slice';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { toggleTaskDrawer } from '../../../../features/tasks/tasks.slice';

type RoadmapGrantChartProps = {
  view: ViewMode;
};

const RoadmapGrantChart = ({ view }: RoadmapGrantChartProps) => {
  // get task list from roadmap slice
  const tasks = useAppSelector(state => state.roadmapReducer.tasksList);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const dispatch = useAppDispatch();

  // column widths for each view mods
  let columnWidth = 60;
  if (view === ViewMode.Year) {
    columnWidth = 350;
  } else if (view === ViewMode.Month) {
    columnWidth = 300;
  } else if (view === ViewMode.Week) {
    columnWidth = 250;
  }

  //   function to handle double click
  const handleDoubleClick = () => {
    dispatch(toggleTaskDrawer());
  };

  //   function to handle date change
  const handleTaskDateChange = (task: Task) => {
    trackMixpanelEvent(evt_roadmap_drag_change_date);
    dispatch(updateTaskDate({ taskId: task.id, start: task.start, end: task.end }));
  };

  //   function to handle progress change
  const handleTaskProgressChange = (task: Task) => {
    dispatch(updateTaskProgress({ taskId: task.id, progress: task.progress }));
  };

  // function to convert the tasklist comming form roadmap slice which has NewTaskType converted to Task type which is the default type of the tasks list in the grant chart
  const flattenTasks = (tasks: NewTaskType[]): Task[] => {
    const flattened: Task[] = [];

    const addTaskAndSubTasks = (task: NewTaskType, parentExpanded: boolean) => {
      // add the task to the flattened list if its parent is expanded or it is a top-level task
      if (parentExpanded) {
        const { subTasks, isExpanded, ...rest } = task; // destructure to exclude properties not in Task type
        flattened.push(rest as Task);

        // recursively add subtasks if this task is expanded
        if (subTasks && isExpanded) {
          subTasks.forEach(subTask => addTaskAndSubTasks(subTask as NewTaskType, true));
        }
      }
    };

    // top-level tasks are always visible, start with parentExpanded = true
    tasks.forEach(task => addTaskAndSubTasks(task, true));

    return flattened;
  };

  const flattenedTasksList = flattenTasks(tasks);

  return (
    <div className="w-full max-w-[900px] overflow-x-auto">
      <Gantt
        tasks={flattenedTasksList}
        viewMode={view}
        onDateChange={handleTaskDateChange}
        onProgressChange={handleTaskProgressChange}
        onDoubleClick={handleDoubleClick}
        listCellWidth={''}
        columnWidth={columnWidth}
        todayColor={`rgba(64, 150, 255, 0.2)`}
        projectProgressColor={colors.limeGreen}
        projectBackgroundColor={colors.lightGreen}
      />
    </div>
  );
};

export default RoadmapGrantChart;
