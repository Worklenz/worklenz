import { IChartObject } from "./overview/reporting-overview-base";

export interface IDuration {
  label: string;
  key: string;
}

export interface IReportingInfo {
  organization_name: string;
}

export interface ITeamStatistics {
  count: number;
  projects: number;
  members: number;
}

export interface IProjectStatistics {
  count: number;
  active: number;
  overdue: number;
}

export interface IMemberStatistics {
  count: number;
  unassigned: number;
  overdue: number;
}

export interface IOverviewStatistics {
  teams: ITeamStatistics;
  projects: IProjectStatistics;
  members: IMemberStatistics;
}

export interface IChartData {
  chart: IChartObject[];
}

export interface ITasksByStatus extends IChartData {
  all: number;
  todo: number;
  doing: number;
  done: number;
}

export interface ITasksByPriority extends IChartData {
  all: number;
  low: number;
  medium: number;
  high: number;
}

export interface ITasksByDue extends IChartData {
  all: number;
  completed: number;
  upcoming: number;
  overdue: number;
  no_due: number;
}
