export interface Task {
  taskName: string;
  taskId: string;
  taskStatus: string;
}

export interface Project {
  projectName: string;
  projectId: string;
  perDayHours: number;
  totalHours: number;
  startDate: string;
  endDate: string;
  tasks: Task[];
}

export interface timeLogged {
  date: string;
  hours: number;
}

export interface Member {
  memberName: string;
  memberId: string;
  projects: Project[];
  timeLogged: timeLogged[];
}
