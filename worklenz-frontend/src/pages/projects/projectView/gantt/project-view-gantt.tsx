import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Flex, Skeleton, Empty, message } from 'antd';
// @ts-ignore - wx-react-gantt doesn't have TypeScript definitions
import { Gantt, Willow, WillowDark } from 'wx-react-gantt';
import 'wx-react-gantt/dist/gantt.css';
// import './gantt-custom-styles.css'; // Temporarily disabled

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchTaskAssignees } from '@/features/tasks/tasks.slice';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import TaskListFilters from '../taskList/task-list-filters/task-list-filters';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { colors } from '@/styles/colors';

// Transform Worklenz task data to SVAR Gantt format
const transformTasksToGanttData = (taskGroups: ITaskListGroup[]) => {
  const tasks: any[] = [];
  const links: any[] = [];
  
  taskGroups.forEach((group, groupIndex) => {
    // Add group as a summary task
    if (group.tasks.length > 0) {
      const groupStartDate = group.start_date ? new Date(group.start_date) : new Date();
      const groupEndDate = group.end_date ? new Date(group.end_date) : new Date();
      
      tasks.push({
        id: `group-${group.id}`,
        text: group.name,
        start: groupStartDate,
        end: groupEndDate,
        type: 'summary',
        open: true,
        parent: 0,
        progress: Math.round((group.done_progress || 0) * 100) / 100,
        details: `Status: ${group.name}`,
        $custom_class: 'gantt-group-row',
        $group_type: group.name.toLowerCase().replace(/\s+/g, '-'),
      });

      // Add individual tasks
      group.tasks.forEach((task: IProjectTask, taskIndex: number) => {
        const startDate = task.start_date ? new Date(task.start_date) : new Date();
        const endDate = task.end_date ? new Date(task.end_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default to 1 week from now
        
        // Handle task type
        let taskType = 'task';
        if (task.sub_tasks_count && task.sub_tasks_count > 0) {
          taskType = 'summary';
        }
        
        const ganttTask = {
          id: task.id,
          text: task.name || 'Untitled Task',
          start: startDate,
          end: endDate,
          type: taskType,
          parent: `group-${group.id}`,
          progress: (task.progress || 0) / 100,
          details: task.description || '',
          priority: task.priority_name || 'Normal',
          status: task.status || 'New',
          assignees: task.names?.map(member => member.name).join(', ') || '',
        };

        tasks.push(ganttTask);

        // Add subtasks if they exist
        if (task.sub_tasks && task.sub_tasks.length > 0) {
          task.sub_tasks.forEach((subTask: IProjectTask) => {
            const subStartDate = subTask.start_date ? new Date(subTask.start_date) : startDate;
            const subEndDate = subTask.end_date ? new Date(subTask.end_date) : endDate;
            
            tasks.push({
              id: subTask.id,
              text: subTask.name || 'Untitled Subtask',
              start: subStartDate,
              end: subEndDate,
              type: 'task',
              parent: task.id,
              progress: (subTask.progress || 0) / 100,
              details: subTask.description || '',
              priority: subTask.priority_name || 'Normal',
              status: subTask.status || 'New',
              assignees: subTask.names?.map(member => member.name).join(', ') || '',
            });
          });
        }
      });
    }
  });

  return { tasks, links };
};

const ProjectViewGantt = () => {
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Redux selectors
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const taskGroups = useAppSelector(state => state.taskReducer.taskGroups);
  const loadingGroups = useAppSelector(state => state.taskReducer.loadingGroups);
  const groupBy = useAppSelector(state => state.taskReducer.groupBy);
  const archived = useAppSelector(state => state.taskReducer.archived);
  const fields = useAppSelector(state => state.taskReducer.fields);
  const search = useAppSelector(state => state.taskReducer.search);

  const statusCategories = useAppSelector(state => state.taskStatusReducer.statusCategories);
  const loadingStatusCategories = useAppSelector(state => state.taskStatusReducer.loading);

  const loadingPhases = useAppSelector(state => state.phaseReducer.loadingPhases);

  // Get theme mode from Worklenz theme system
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  // Debug theme detection
  useEffect(() => {
    console.log('Theme mode detected:', themeMode, 'isDarkMode:', isDarkMode);
  }, [themeMode, isDarkMode]);

  // Loading state
  const isLoading = useMemo(() => 
    loadingGroups || loadingPhases || loadingStatusCategories || !initialLoadComplete,
    [loadingGroups, loadingPhases, loadingStatusCategories, initialLoadComplete]
  );

  // Empty state check
  const isEmptyState = useMemo(() => 
    taskGroups && taskGroups.length === 0 && !isLoading,
    [taskGroups, isLoading]
  );

  // Transform data for SVAR Gantt
  const ganttData = useMemo(() => {
    if (!taskGroups || taskGroups.length === 0) {
      return { tasks: [], links: [] };
    }
    
    // // Test with hardcoded data first to isolate the issue
    // const testData = {
    //   tasks: [
    //     {
    //       id: 1,
    //       text: "Test Project",
    //       start: new Date(2024, 0, 1),
    //       end: new Date(2024, 0, 15),
    //       type: "summary",
    //       open: true,
    //       parent: 0,
    //       progress: 0.5,
    //     },
    //     {
    //       id: 2,
    //       text: "Test Task 1",
    //       start: new Date(2024, 0, 2),
    //       end: new Date(2024, 0, 8),
    //       type: "task",
    //       parent: 1,
    //       progress: 0.3,
    //     },
    //     {
    //       id: 3,
    //       text: "Test Task 2",
    //       start: new Date(2024, 0, 9),
    //       end: new Date(2024, 0, 14),
    //       type: "task",
    //       parent: 1,
    //       progress: 0.7,
    //     },
    //   ],
    //   links: [],
    // };
    
    // console.log('Using test data for debugging:', testData);
    // return testData;
    
    // Original transformation (commented out for testing)
    const result = transformTasksToGanttData(taskGroups);
    console.log('Gantt data - tasks count:', result.tasks.length);
    if (result.tasks.length > 0) {
      console.log('First task:', result.tasks[0]);
      console.log('Sample dates:', result.tasks[0]?.start, result.tasks[0]?.end);
    }
    return result;
  }, [taskGroups]);

  // Calculate date range for the Gantt chart
  const dateRange = useMemo(() => {
    // Fixed range for testing
    // return {
    //   start: new Date(2023, 11, 1), // December 1, 2023
    //   end: new Date(2024, 1, 29),   // February 29, 2024
    // };
    
    // Original dynamic calculation (commented out for testing)
    if (ganttData.tasks.length === 0) {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth() + 2, 0),
      };
    }

    const dates = ganttData.tasks.map(task => [task.start, task.end]).flat();
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add some padding
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(maxDate);
    endDate.setDate(endDate.getDate() + 7);
    
    return { start: startDate, end: endDate };
  }, [ganttData.tasks]);

  // Batch initial data fetching
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!projectId || !groupBy || initialLoadComplete) return;

      try {
        await Promise.allSettled([
          dispatch(fetchPhasesByProjectId(projectId)),
          dispatch(fetchStatusesCategories()),
          dispatch(fetchTaskAssignees(projectId)),
        ]);
        setInitialLoadComplete(true);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setInitialLoadComplete(true);
      }
    };

    fetchInitialData();
  }, [projectId, groupBy, dispatch, initialLoadComplete]);

  // Fetch task groups
  useEffect(() => {
    const fetchTasks = async () => {
      if (!projectId || !groupBy || !initialLoadComplete) return;

      try {
        await dispatch(fetchTaskGroups(projectId));
      } catch (error) {
        console.error('Error fetching task groups:', error);
        message.error('Failed to load tasks for Gantt chart');
      }
    };

    fetchTasks();
  }, [projectId, groupBy, dispatch, fields, search, archived, initialLoadComplete]);

  // Gantt configuration
  const ganttConfig = useMemo(() => ({
    // Time scale configuration
    scales: [
      { unit: 'month', step: 1, format: 'MMMM yyyy' },
      { unit: 'day', step: 1, format: 'd' },
    ],
    
    // Columns configuration
    columns: [
      { id: 'text', header: 'Task Name', width: 200 },
      { id: 'start', header: 'Start Date', width: 100 },
      { id: 'end', header: 'End Date', width: 100 },
      { id: 'progress', header: 'Progress', width: 80 },
    ],

    // Event handlers
    onTaskClick: (task: any) => {
      console.log('Task clicked:', task);
      // TODO: Open task drawer
    },

    onTaskUpdate: (task: any) => {
      console.log('Task updated:', task);
      // TODO: Update task via API
    },

    // Style configuration
    taskHeight: 32,
    rowHeight: 40,
  }), []);

  if (isEmptyState) {
    return (
      <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
        <TaskListFilters position="list" />
        <Empty description="No tasks found for Gantt chart" />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      <TaskListFilters position="list" />
      
      <style>{`
        .wx-gantt {
          font-family: inherit !important;
        }
        .wx-gantt-task {
          background-color: #3983eb !important;
          border: 1px solid #1f6bd9 !important;
        }
        .wx-gantt-project {
          background-color: #00ba94 !important;
          border: 1px solid #099f81 !important;
        }
        
        /* Highlight group names (summary tasks) */
        .wx-gantt-summary {
          background-color: #722ed1 !important;
          border: 2px solid #531dab !important;
          font-weight: 600 !important;
        }
        
        /* Group name text styling */
        .wx-gantt-row[data-task-type="summary"] .wx-gantt-cell-text {
          font-weight: 700 !important;
          font-size: 14px !important;
          color: #722ed1 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }
        
        /* Group row background highlighting */
        .wx-gantt-row[data-task-type="summary"] {
          background-color: ${isDarkMode ? 'rgba(114, 46, 209, 0.1)' : 'rgba(114, 46, 209, 0.05)'} !important;
        }
        
        /* Different colors for different group types */
        .gantt-group-row .wx-gantt-cell-text,
        .wx-gantt-row[data-task-id*="group-"] .wx-gantt-cell-text {
          position: relative;
        }
        
        /* Todo/To Do groups - Red */
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("Todo")) .wx-gantt-cell-text,
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("TO DO")) .wx-gantt-cell-text,
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("To Do")) .wx-gantt-cell-text {
          color: #f5222d !important;
          background: linear-gradient(90deg, rgba(245, 34, 45, 0.1) 0%, transparent 100%) !important;
          padding-left: 8px !important;
          border-left: 4px solid #f5222d !important;
        }
        
        /* Doing/In Progress groups - Orange */
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("Doing")) .wx-gantt-cell-text,
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("IN PROGRESS")) .wx-gantt-cell-text,
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("In Progress")) .wx-gantt-cell-text {
          color: #fa8c16 !important;
          background: linear-gradient(90deg, rgba(250, 140, 22, 0.1) 0%, transparent 100%) !important;
          padding-left: 8px !important;
          border-left: 4px solid #fa8c16 !important;
        }
        
        /* Done/Completed groups - Green */
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("Done")) .wx-gantt-cell-text,
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("COMPLETED")) .wx-gantt-cell-text,
        .wx-gantt-row[data-task-id*="group-"]:has(.wx-gantt-cell-text:contains("Completed")) .wx-gantt-cell-text {
          color: #52c41a !important;
          background: linear-gradient(90deg, rgba(82, 196, 26, 0.1) 0%, transparent 100%) !important;
          padding-left: 8px !important;
          border-left: 4px solid #52c41a !important;
        }
        
        ${isDarkMode ? `
          .wx-gantt-task {
            background-color: #37a9ef !important;
            border: 1px solid #098cdc !important;
          }
          .wx-gantt-summary {
            background-color: #9254de !important;
            border: 2px solid #722ed1 !important;
          }
          .wx-gantt-row[data-task-type="summary"] .wx-gantt-cell-text {
            color: #b37feb !important;
          }
        ` : ''}
      `}</style>
      
      <Skeleton active loading={isLoading} className='mt-4 p-4'>
        <div 
          style={{ 
            height: '600px', 
            width: '100%',
            border: `1px solid ${isDarkMode ? '#424242' : '#d9d9d9'}`,
            borderRadius: '6px',
            backgroundColor: isDarkMode ? colors.darkGray : colors.white,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {isDarkMode ? (
            <WillowDark>
              <Gantt
                tasks={ganttData.tasks}
                links={ganttData.links}
                start={dateRange.start}
                end={dateRange.end}
                scales={[
                  { unit: 'month', step: 1, format: 'MMMM yyyy' },
                  { unit: 'day', step: 1, format: 'd' }
                ]}
                columns={[
                  { id: 'text', header: 'Task Name', width: 200 },
                  { id: 'start', header: 'Start Date', width: 100 },
                  { id: 'end', header: 'End Date', width: 100 }
                ]}
              />
            </WillowDark>
          ) : (
            <Willow>
              <Gantt
                tasks={ganttData.tasks}
                links={ganttData.links}
                start={dateRange.start}
                end={dateRange.end}
                scales={[
                  { unit: 'month', step: 1, format: 'MMMM yyyy' },
                  { unit: 'day', step: 1, format: 'd' }
                ]}
                columns={[
                  { id: 'text', header: 'Task Name', width: 200 },
                  { id: 'start', header: 'Start Date', width: 100 },
                  { id: 'end', header: 'End Date', width: 100 }
                ]}
              />
            </Willow>
          )}
        </div>
      </Skeleton>
    </Flex>
  );
};

export default ProjectViewGantt; 