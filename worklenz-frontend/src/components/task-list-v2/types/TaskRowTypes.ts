import { Task } from '@/types/task-management.types';
import { dayjs } from '@/shared/antd-imports';

export interface TaskRowColumn {
  id: string;
  width: string;
  isSticky?: boolean;
  key?: string;
  custom_column?: boolean;
  custom_column_obj?: any;
  isCustom?: boolean;
}

export interface TaskRowProps {
  taskId: string;
  projectId: string;
  visibleColumns: TaskRowColumn[];
  isSubtask?: boolean;
  isFirstInGroup?: boolean;
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string) => void;
}

export interface TaskRowState {
  activeDatePicker: string | null;
  editTaskName: boolean;
  taskName: string;
}

export interface TaskRowComputedValues {
  taskDisplayName: string;
  convertedTask: ConvertedTask;
  formattedDates: FormattedDates;
  dateValues: DateValues;
  labelsAdapter: LabelsAdapter;
}

export interface ConvertedTask {
  id: string;
  name: string;
  task_key: string;
  assignees: ConvertedAssignee[];
  parent_task_id?: string;
  status_id?: string;
  project_id?: string;
  manual_progress?: boolean;
}

export interface ConvertedAssignee {
  team_member_id: string;
  id: string;
  project_member_id: string;
  name: string;
}

export interface FormattedDates {
  due: string | null;
  start: string | null;
  completed: string | null;
  created: string | null;
  updated: string | null;
}

export interface DateValues {
  start: dayjs.Dayjs | undefined;
  due: dayjs.Dayjs | undefined;
}

export interface LabelsAdapter {
  id: string;
  name: string;
  parent_task_id?: string;
  manual_progress: boolean;
  all_labels: LabelInfo[];
  labels: LabelInfo[];
}

export interface LabelInfo {
  id: string;
  name: string;
  color_code: string;
}

export interface TaskRowActions {
  handleCheckboxChange: (e: any) => void;
  handleTaskNameSave: () => void;
  handleTaskNameEdit: () => void;
  handleTaskNameChange: (name: string) => void;
}

export interface ColumnRendererProps {
  task: Task;
  projectId: string;
  isSubtask: boolean;
  isSelected: boolean;
  isDarkMode: boolean;
  visibleColumns: TaskRowColumn[];
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string) => void;
  taskDisplayName: string;
  convertedTask: ConvertedTask;
  formattedDates: FormattedDates;
  dateValues: DateValues;
  labelsAdapter: LabelsAdapter;
  activeDatePicker: string | null;
  setActiveDatePicker: (field: string | null) => void;
  editTaskName: boolean;
  taskName: string;
  setEditTaskName: (editing: boolean) => void;
  setTaskName: (name: string) => void;
  handleCheckboxChange: (e: any) => void;
  handleTaskNameSave: () => void;
  handleTaskNameEdit: () => void;
  attributes: any;
  listeners: any;
}

export type ColumnId =
  | 'dragHandle'
  | 'checkbox'
  | 'taskKey'
  | 'title'
  | 'description'
  | 'status'
  | 'assignees'
  | 'priority'
  | 'dueDate'
  | 'startDate'
  | 'progress'
  | 'labels'
  | 'phase'
  | 'timeTracking'
  | 'estimation'
  | 'completedDate'
  | 'createdDate'
  | 'lastUpdated'
  | 'reporter'
  | string; // Allow custom column IDs

export interface BaseColumnProps {
  width: string;
}

export interface DragHandleColumnProps extends BaseColumnProps {
  isSubtask: boolean;
  attributes: any;
  listeners: any;
}

export interface CheckboxColumnProps extends BaseColumnProps {
  isSelected: boolean;
  onCheckboxChange: (e: any) => void;
}

export interface TaskKeyColumnProps extends BaseColumnProps {
  taskKey: string;
}

export interface TitleColumnProps extends BaseColumnProps {
  task: Task;
  projectId: string;
  isSubtask: boolean;
  taskDisplayName: string;
  editTaskName: boolean;
  taskName: string;
  onEditTaskName: (editing: boolean) => void;
  onTaskNameChange: (name: string) => void;
  onTaskNameSave: () => void;
}

export interface DescriptionColumnProps extends BaseColumnProps {
  description: string;
}

export interface StatusColumnProps extends BaseColumnProps {
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export interface AssigneesColumnProps extends BaseColumnProps {
  task: Task;
  convertedTask: ConvertedTask;
  isDarkMode: boolean;
}

export interface PriorityColumnProps extends BaseColumnProps {
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export interface DatePickerColumnProps extends BaseColumnProps {
  task: Task;
  field: 'dueDate' | 'startDate';
  formattedDate: string | null;
  dateValue: dayjs.Dayjs | undefined;
  isDarkMode: boolean;
  activeDatePicker: string | null;
  onActiveDatePickerChange: (field: string | null) => void;
}

export interface ProgressColumnProps extends BaseColumnProps {
  task: Task;
}

export interface LabelsColumnProps extends BaseColumnProps {
  task: Task;
  labelsAdapter: LabelsAdapter;
  isDarkMode: boolean;
  visibleColumns: TaskRowColumn[];
}

export interface PhaseColumnProps extends BaseColumnProps {
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export interface TimeTrackingColumnProps extends BaseColumnProps {
  taskId: string;
  isDarkMode: boolean;
}

export interface EstimationColumnProps extends BaseColumnProps {
  task: Task;
}

export interface DateColumnProps extends BaseColumnProps {
  formattedDate: string | null;
  placeholder?: string;
}

export interface ReporterColumnProps extends BaseColumnProps {
  reporter: string;
}

export interface CustomColumnProps extends BaseColumnProps {
  column: TaskRowColumn;
  task: Task;
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string) => void;
}

export interface TaskLabelsCellProps {
  labels: Task['labels'];
  isDarkMode: boolean;
}
