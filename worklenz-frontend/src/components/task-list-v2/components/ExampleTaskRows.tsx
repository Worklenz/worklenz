import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input, message } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import {
  UNMAPPED_PHASE_ID,
  useTaskListMode,
} from '@/features/task-management/task-list-mode-context';
import { assignTaskToMember } from '@/utils/assign-task-to-member';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { EpicColumn } from './EpicColumn';
import { PointsColumn } from './PointsColumn';
import { DatePickerColumn } from './DatePickerColumn';
import {
  DragHandleColumn,
  CheckboxColumn,
  TaskKeyColumn,
  StatusColumn,
  AssigneesColumn,
  PriorityColumn,
  ProgressColumn,
  LabelsColumnWithOverflow,
  PhaseColumn,
  TimeTrackingColumn,
  EstimationColumn,
  DateColumn,
  ReporterColumn,
  DescriptionColumn,
} from './TaskRowColumns';

export const ExampleTaskRows: React.FC<{
  visibleColumns: any[];
  isDarkMode?: boolean;
  groupId: string;
  groupType: string;
  groupValue: string;
  groupName: string;
  groupColor: string;
  projectId: string;
  canCreateTask?: boolean;
  /** When false, examples are visual only (used before the first sprint exists). */
  interactive?: boolean;
  onTaskCreated: (
    task: any,
    options?: { openDrawer: boolean; insertAfterTaskId?: string | null }
  ) => void;
}> = ({
  visibleColumns,
  isDarkMode = false,
  groupId,
  groupType,
  groupValue,
  groupName,
  groupColor,
  projectId,
  canCreateTask = true,
  interactive = true,
  onTaskCreated,
}) => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const priorities = useAppSelector((state: any) => state.priorityReducer?.priorities || []);
  const mediumPriority =
    priorities.find((p: any) => p.value === '1' || p.value === 1) || priorities[0];

  const [showPlaceholders, setShowPlaceholders] = React.useState(false);
  const [activeRowIndex, setActiveRowIndex] = React.useState<number | null>(null);
  const [taskName, setTaskName] = React.useState('');
  const [creatingTask, setCreatingTask] = React.useState(false);
  const inputRef = React.useRef<any>(null);
  const isMounted = React.useRef(true);
  const isRequestPending = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  const listMode = useTaskListMode();

  const projectType = useAppSelector(state => state.projectReducer.project?.project_type);
  const isSoftwareProject = isSoftwareProjectType(projectType);
  const exampleTaskNames = isSoftwareProject
    ? [
        t('exampleIssues.issue1', { defaultValue: 'Fix login redirect loop' }),
        t('exampleIssues.issue2', { defaultValue: 'Add API rate limiting' }),
        t('exampleIssues.issue3', { defaultValue: 'Set up CI pipeline' }),
      ]
    : [
        t('exampleTasks.task1', { defaultValue: 'Define project scope and objectives' }),
        t('exampleTasks.task2', { defaultValue: 'Review and align with stakeholders' }),
        t('exampleTasks.task3', { defaultValue: 'Schedule kickoff meeting' }),
      ];
  const addTaskPlaceholder = isSoftwareProject
    ? t('createIssueInputPlaceholder', {
        defaultValue: 'Type issue title and press Enter to save',
      })
    : t('addTaskInputPlaceholder', {
        defaultValue: 'Type task name and press Enter to save',
      });
  const egPrefix = t('exampleTasks.prefix', { defaultValue: 'e.g.' });

  React.useEffect(() => {
    const timer = setTimeout(() => setShowPlaceholders(true), 350);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (activeRowIndex !== null) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [activeRowIndex]);

  const handleCreateTask = React.useCallback(
    (openDrawer: boolean = false) => {
      if (isRequestPending.current || !currentSession || !taskName.trim() || !socket || !connected) return;

      const body: any = {
        name: taskName.trim(),
        project_id: projectId,
        reporter_id: currentSession.id,
        team_id: currentSession.team_id,
      };

      switch (groupType) {
        case 'status':
          body.status_id = groupValue;
          break;
        case 'priority':
          body.priority_id = groupValue;
          break;
        case 'phase':
          body.phase_id = groupValue;
          break;
        case 'assignee':
          break;
        default:
          body[groupType] = groupValue;
          break;
      }

      // Backlog tab: keep newly created issues unassigned to a sprint
      if (listMode === 'backlog' && !body.phase_id) {
        body.phase_id = UNMAPPED_PHASE_ID;
      }

      isRequestPending.current = true;
      let hasSettled = false;
      setCreatingTask(true);
      socket.timeout(15000).emit(
        SocketEvents.QUICK_TASK.toString(),
        JSON.stringify(body),
        (error: Error | null, task: { id?: string; error?: boolean } | null) => {
          if (hasSettled) return;
          hasSettled = true;
          isRequestPending.current = false;
          if (isMounted.current) setCreatingTask(false);
          if (error || !task?.id || task.error) {
            if (isMounted.current) message.error(t('exampleTaskCreateFailed', {
              defaultValue: 'Could not confirm task creation. Check the task list before retrying.',
            }));
            return;
          }
          if (groupType === 'assignee') {
            assignTaskToMember({
              socket,
              taskId: task.id,
              projectId,
              teamMemberId: groupValue,
              reporterId: currentSession.id,
              teamId: currentSession.team_id,
            });
          }
          if (isMounted.current) {
            setTaskName('');
            setActiveRowIndex(null);
            onTaskCreated(task, { openDrawer, insertAfterTaskId: null });
          }
        }
      );
    },
    [
      creatingTask,
      taskName,
      projectId,
      groupType,
      groupValue,
      socket,
      connected,
      currentSession,
      onTaskCreated,
      listMode,
      t,
    ]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreateTask(false);
      } else if (e.key === 'Escape' && !creatingTask) {
        e.preventDefault();
        setTaskName('');
        setActiveRowIndex(null);
      }
    },
    [handleCreateTask, creatingTask]
  );

  const handleBlur = React.useCallback(() => {
    if (creatingTask) return;
    if (taskName.trim()) handleCreateTask(false);
    else setActiveRowIndex(null);
  }, [taskName, handleCreateTask, creatingTask]);

  return (
    <>
      {exampleTaskNames.map((name, rowIndex) => {
        // Build a minimal mock task so real column components render correctly.
        // pointer-events:none on the wrapper prevents any socket/API calls.
        const mockTask: any = {
          id: `_example_${rowIndex}`,
          name,
          title: name,
          // Status — pass display fields so StatusColumn renders the badge
          status_id: groupType === 'status' ? groupValue : undefined,
          status: groupType === 'status' ? groupName : undefined,
          color_code: groupType === 'status' ? groupColor : undefined,
          // Priority — use group data when grouped by priority, otherwise default to Medium
          priority_id: groupType === 'priority' ? groupValue : mediumPriority?.id,
          priority: groupType === 'priority' ? groupName : mediumPriority?.name,
          priority_color: groupType === 'priority' ? groupColor : mediumPriority?.color_code,
          priority_color_dark:
            groupType === 'priority'
              ? groupColor
              : mediumPriority?.color_code_dark || mediumPriority?.color_code,
          priority_value: groupType === 'priority' ? undefined : mediumPriority?.value,
          // Phase
          phase_id: groupType === 'phase' ? groupValue : undefined,
          phase:
            groupType === 'phase' && groupValue !== UNMAPPED_PHASE_ID
              ? groupValue.replace('phase-', '')
              : undefined,
          names: [],
          labels: [],
          sub_tasks: [],
          sub_tasks_count: 0,
          show_sub_tasks: false,
          task_key: '',
          description: '',
          done: false,
          archived: false,
          created_at: '',
          updated_at: '',
        };

        const canActivateRow = interactive && canCreateTask && activeRowIndex === null;

        return (
          <div
            key={rowIndex}
            className={`flex items-center min-w-max px-1 border-b border-gray-200 dark:border-gray-700 ${
              interactive ? 'hover:bg-gray-50 dark:hover:bg-gray-800/30' : ''
            }`}
            style={{
              height: '40px',
              cursor: canActivateRow ? 'text' : 'default',
              pointerEvents: interactive ? undefined : 'none',
              userSelect: interactive ? undefined : 'none',
            }}
            onClick={() => {
              if (canActivateRow) setActiveRowIndex(rowIndex);
            }}
          >
            {visibleColumns.map((column, colIndex) => {
              let leftPosition = 0;
              if (column.isSticky) {
                for (let i = 0; i < colIndex; i++) {
                  leftPosition += parseInt(visibleColumns[i].width.replace('px', ''));
                }
              }
              const colStyle: React.CSSProperties = {
                width: column.width,
                flexShrink: 0,
                ...(column.isSticky && {
                  position: 'sticky',
                  left: leftPosition,
                  zIndex: 10,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--tl-sticky-cell-bg)',
                }),
              };

              // Title: "e.g." hint text or active inline input
              if (column.id === 'title') {
                return (
                  <div
                    key={column.id}
                    className="flex items-center pl-8 border-r border-gray-200 dark:border-gray-700 h-full"
                    style={colStyle}
                  >
                    {activeRowIndex === rowIndex ? (
                      <Input
                        ref={inputRef}
                        value={taskName}
                        onChange={e => setTaskName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder={addTaskPlaceholder}
                        className="w-full border-none shadow-none bg-transparent"
                        style={{ height: '100%', padding: '4px 8px', fontSize: '14px' }}
                        disabled={creatingTask}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={!canActivateRow}
                        onClick={() => { if (canActivateRow) setActiveRowIndex(rowIndex); }}
                        className="text-sm text-gray-400 dark:text-gray-500 truncate bg-transparent border-0 p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                        style={{
                          opacity: showPlaceholders ? 1 : 0,
                          transition: 'opacity 0.25s ease-in',
                        }}
                      >
                        {egPrefix} {name}
                      </button>
                    )}
                  </div>
                );
              }

              // All other columns: render the real component, block interactions
              const renderContent = () => {
                switch (column.id) {
                  case 'dragHandle':
                    return (
                      <DragHandleColumn
                        width={column.width}
                        isSubtask={false}
                        attributes={{}}
                        listeners={{}}
                      />
                    );
                  case 'checkbox':
                    return (
                      <CheckboxColumn
                        width={column.width}
                        isSelected={false}
                        onCheckboxChange={() => {}}
                      />
                    );
                  case 'taskKey':
                    return <TaskKeyColumn width={column.width} taskKey="" />;
                  case 'description':
                    return (
                      <DescriptionColumn width={column.width} description="" taskId={mockTask.id} />
                    );
                  case 'status':
                    return (
                      <StatusColumn
                        width={column.width}
                        task={mockTask}
                        projectId={projectId}
                        isDarkMode={isDarkMode}
                      />
                    );
                  case 'assignees':
                    return (
                      <AssigneesColumn
                        width={column.width}
                        task={mockTask}
                        convertedTask={mockTask}
                        isDarkMode={isDarkMode}
                        canCreateTask={true}
                      />
                    );
                  case 'priority':
                    return (
                      <PriorityColumn
                        width={column.width}
                        task={mockTask}
                        projectId={projectId}
                        isDarkMode={isDarkMode}
                      />
                    );
                  case 'dueDate':
                    return (
                      <DatePickerColumn
                        width={column.width}
                        task={mockTask}
                        field="dueDate"
                        formattedDate={null}
                        dateValue={undefined}
                        isDarkMode={isDarkMode}
                        activeDatePicker={null}
                        onActiveDatePickerChange={() => {}}
                      />
                    );
                  case 'startDate':
                    return (
                      <DatePickerColumn
                        width={column.width}
                        task={mockTask}
                        field="startDate"
                        formattedDate={null}
                        dateValue={undefined}
                        isDarkMode={isDarkMode}
                        activeDatePicker={null}
                        onActiveDatePickerChange={() => {}}
                      />
                    );
                  case 'progress':
                    return <ProgressColumn width={column.width} task={mockTask} />;
                  case 'labels':
                    return (
                      <LabelsColumnWithOverflow
                        width={column.width}
                        task={mockTask}
                        labelsAdapter={[]}
                        isDarkMode={isDarkMode}
                        columnId={column.id}
                      />
                    );
                  case 'phase':
                    return (
                      <PhaseColumn
                        width={column.width}
                        task={mockTask}
                        projectId={projectId}
                        isDarkMode={isDarkMode}
                      />
                    );
                  case 'epic':
                    return (
                      <EpicColumn
                        width={column.width}
                        task={mockTask}
                        projectId={projectId}
                        disabled
                      />
                    );
                  case 'points':
                    return (
                      <PointsColumn
                        width={column.width}
                        task={mockTask}
                        projectId={projectId}
                        disabled
                      />
                    );
                  case 'timeTracking':
                    return (
                      <TimeTrackingColumn
                        width={column.width}
                        taskId={mockTask.id}
                        isDarkMode={isDarkMode}
                      />
                    );
                  case 'estimation':
                    return <EstimationColumn width={column.width} task={mockTask} />;
                  case 'completedDate':
                    return <DateColumn width={column.width} formattedDate="" />;
                  case 'createdDate':
                    return <DateColumn width={column.width} formattedDate="" />;
                  case 'lastUpdated':
                    return <DateColumn width={column.width} formattedDate="" />;
                  case 'reporter':
                    return <ReporterColumn width={column.width} reporter="" />;
                  default:
                    return (
                      <div
                        className="border-r border-gray-200 dark:border-gray-700"
                        style={{ width: column.width }}
                      />
                    );
                }
              };

              return (
                <div
                  key={column.id}
                  ref={element => { if (element) element.inert = true; }}
                  aria-hidden="true"
                  style={{
                    ...colStyle,
                    pointerEvents: 'none',
                    opacity: showPlaceholders ? 1 : 0,
                    transition: 'opacity 0.25s ease-in',
                  }}
                >
                  {renderContent()}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
};
