import { COLUMN_KEYS } from '@/features/tasks/tasks.slice';

export type ColumnStyle = {
  width: string;
  position?: 'static' | 'relative' | 'absolute' | 'sticky' | 'fixed';
  left?: number;
  backgroundColor?: string;
  zIndex?: number;
  flexShrink?: number;
  minWidth?: string;
  maxWidth?: string;
};

// Base column configuration
export const BASE_COLUMNS = [
  { id: 'dragHandle', label: '', width: '20px', isSticky: true, key: 'dragHandle' },
  { id: 'checkbox', label: '', width: '28px', isSticky: true, key: 'checkbox' },
  {
    id: 'taskKey',
    label: 'keyColumn',
    width: '100px',
    key: COLUMN_KEYS.KEY,
    minWidth: '100px',
    maxWidth: '150px',
  },
  { id: 'title', label: 'taskColumn', width: '470px', isSticky: true, key: COLUMN_KEYS.NAME },
  { id: 'description', label: 'descriptionColumn', width: '260px', key: COLUMN_KEYS.DESCRIPTION },
  { id: 'progress', label: 'progressColumn', width: '120px', key: COLUMN_KEYS.PROGRESS },
  { id: 'status', label: 'statusColumn', width: '120px', key: COLUMN_KEYS.STATUS },
  { id: 'assignees', label: 'assigneesColumn', width: '150px', key: COLUMN_KEYS.ASSIGNEES },
  { id: 'labels', label: 'labelsColumn', width: '250px', key: COLUMN_KEYS.LABELS },
  { id: 'phase', label: 'phaseColumn', width: '120px', key: COLUMN_KEYS.PHASE },
  { id: 'priority', label: 'priorityColumn', width: '120px', key: COLUMN_KEYS.PRIORITY },
  {
    id: 'timeTracking',
    label: 'timeTrackingColumn',
    width: '120px',
    key: COLUMN_KEYS.TIME_TRACKING,
  },
  { id: 'estimation', label: 'estimationColumn', width: '120px', key: COLUMN_KEYS.ESTIMATION },
  { id: 'startDate', label: 'startDateColumn', width: '140px', key: COLUMN_KEYS.START_DATE },
  { id: 'dueDate', label: 'dueDateColumn', width: '140px', key: COLUMN_KEYS.DUE_DATE },
  { id: 'dueTime', label: 'dueTimeColumn', width: '120px', key: COLUMN_KEYS.DUE_TIME },
  {
    id: 'completedDate',
    label: 'completedDateColumn',
    width: '140px',
    key: COLUMN_KEYS.COMPLETED_DATE,
  },
  { id: 'createdDate', label: 'createdDateColumn', width: '140px', key: COLUMN_KEYS.CREATED_DATE },
  { id: 'lastUpdated', label: 'lastUpdatedColumn', width: '140px', key: COLUMN_KEYS.LAST_UPDATED },
  { id: 'reporter', label: 'reporterColumn', width: '120px', key: COLUMN_KEYS.REPORTER },
];
