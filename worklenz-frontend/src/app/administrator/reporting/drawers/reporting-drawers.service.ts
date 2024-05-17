import {Injectable} from '@angular/core';
import {Subject} from "rxjs";
import {
  IRPTMember,
  IRPTMemberDrawerData,
  IRPTOverviewProject,
  IRPTSingleMemberDrawerData,
  IRPTTaskDrawerData,
  IRPTTasksDrawerData,
  IRPTTeam
} from "../interfaces";
import {ReportingService} from "../reporting.service";

@Injectable({
  providedIn: "root"
})
export class ReportingDrawersService {
  private readonly _openTeamDrawerSbj = new Subject<IRPTTeam | null>();
  private readonly _openProjectDrawerSbj = new Subject<IRPTOverviewProject | null>();
  private readonly _openMemberDrawerSbj = new Subject<IRPTMemberDrawerData>();
  private readonly _openSingleMemberDrawerSbj = new Subject<IRPTSingleMemberDrawerData>();
  private readonly _openTasksDrawerSbj = new Subject<IRPTTasksDrawerData>();
  private readonly _openTaskDrawerSbj = new Subject<IRPTTaskDrawerData>();
  private readonly _openSingleMemberTaskStat = new Subject<{team_member_id: string}>();
  private readonly _openSingleMemberProjects = new Subject<{team_member_id: string}>();
  private readonly _openSingleMemberTimeLogs = new Subject<void>();

  private readonly _singleMemberOverviewSbj = new Subject<void>();
  private readonly _singleMemberTimeLogsSbj = new Subject<void>();
  private readonly _singleMemberActivityLogsSbj = new Subject<void>();
  private readonly _singleMemberProjectsSbj = new Subject<void>();
  private readonly _singleMemberTasksSbj = new Subject<void>();

  constructor(
    private readonly rptService: ReportingService
  ) {
  }

  public get onOpenTeam() {
    return this._openTeamDrawerSbj.asObservable();
  }

  public get onOpenProject() {
    return this._openProjectDrawerSbj.asObservable();
  }

  public get onOpenMember() {
    return this._openMemberDrawerSbj.asObservable();
  }

  public get onOpenSingleMember() {
    return this._openSingleMemberDrawerSbj.asObservable();
  }

  public get onOpenTasks() {
    return this._openTasksDrawerSbj.asObservable();
  }

  public get onOpenTask() {
    return this._openTaskDrawerSbj.asObservable();
  }

  public get onOpenSingleMemberTaskStat() {
    return this._openSingleMemberTaskStat.asObservable();
  }

  public get onOpenSingleMemberProjects() {
    return this._openSingleMemberProjects.asObservable();
  }

  public get onOpenSingleMemberTimeLogs() {
    return this._openSingleMemberTimeLogs.asObservable();
  }

  public openTeam(team: IRPTTeam | null) {
    this.rptService.setCurrentTeam(team);
    this._openTeamDrawerSbj.next(team);
  }

  public openProject(project: IRPTOverviewProject | null) {
    this._openProjectDrawerSbj.next(project);
  }

  public openMember(member: IRPTMember | null, project: IRPTOverviewProject | null) {
    this._openMemberDrawerSbj.next({member, project});
  }

  public openSingleMember(member: IRPTMember | null) {
    this._openSingleMemberDrawerSbj.next({member});
  }

  public openTasks(project: IRPTOverviewProject, member: IRPTMember) {
    this._openTasksDrawerSbj.next({project, member});
  }

  public openTask(data: IRPTTaskDrawerData) {
    this._openTaskDrawerSbj.next(data);
  }

  public openSingleMemberTaskStat(data: {team_member_id: string}) {
    this._openSingleMemberTaskStat.next(data)
  }

  public openSingleMemberProjects(data: {team_member_id: string}) {
    this._openSingleMemberProjects.next(data)
  }

  public openTimeLogsTab() {
    this._openSingleMemberTimeLogs.next();
  }

  public emitGetSingleMemberOverview() {
    this._singleMemberOverviewSbj.next();
  }

  public emitGetSingleMemberTimeLogs() {
    this._singleMemberTimeLogsSbj.next();
  }

  public emitGetSingleMemberActivityLogs() {
    this._singleMemberActivityLogsSbj.next();
  }

  public emitGetSingleMemberProjects() {
    this._singleMemberProjectsSbj.next();
  }

  public emitGetSingleMemberTasks() {
    this._singleMemberTasksSbj.next();
  }

}
