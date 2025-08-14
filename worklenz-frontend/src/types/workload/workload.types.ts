export interface IWorkloadMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  teamId?: string;
  dailyCapacity: number;
  weeklyCapacity: number;
  currentWorkload: number;
  utilizationPercentage: number;
  isOverallocated: boolean;
  isUnderutilized: boolean;
}

export interface ITaskAllocation {
  id: string;
  taskId: string;
  taskName: string;
  projectId: string;
  projectName: string;
  memberId: string;
  memberName: string;
  estimatedHours: number;
  actualHours?: number;
  startDate: string;
  endDate: string;
  priority: string;
  priorityColor?: string;
  status: string;
  statusColor?: string;
  completionPercentage: number;
}

export interface IMemberAvailability {
  memberId: string;
  date: string;
  availableHours: number;
  plannedHours: number;
  actualHours?: number;
  isWorkingDay: boolean;
  isHoliday?: boolean;
  isLeave?: boolean;
}

export interface IWorkloadData {
  projectId: string;
  projectName: string;
  members: IWorkloadMember[];
  allocations: ITaskAllocation[];
  availability: IMemberAvailability[];
  summary: IWorkloadSummary;
}

export interface IWorkloadSummary {
  totalMembers: number;
  totalTasks: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  averageUtilization: number;
  overallocatedMembers: number;
  underutilizedMembers: number;
  criticalTasks: number;
}

export interface IWorkloadFilters {
  startDate: string;
  endDate: string;
  memberIds?: string[];
  teamIds?: string[];
  showOverallocated?: boolean;
  showUnderutilized?: boolean;
  taskStatuses?: string[];
  taskPriorities?: string[];
}

export interface IWorkloadCapacityUpdate {
  projectId: string;
  memberId: string;
  date?: string;
  dailyCapacity?: number;
  weeklyCapacity?: number;
  isAvailable?: boolean;
  notes?: string;
}

export interface IWorkloadTaskReassign {
  projectId: string;
  taskId: string;
  fromMemberId: string;
  toMemberId: string;
  reason?: string;
  notifyMembers?: boolean;
}

export interface IWorkloadChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor?: string;
    stack?: string;
  }[];
}

export interface IWorkloadCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    memberId: string;
    taskId: string;
    type: 'task' | 'leave' | 'holiday';
    utilization: number;
  };
  className?: string;
}

export interface IWorkloadAlert {
  id: string;
  type: 'overallocation' | 'underutilization' | 'deadline' | 'conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  memberId?: string;
  taskId?: string;
  message: string;
  date: string;
  resolved: boolean;
}