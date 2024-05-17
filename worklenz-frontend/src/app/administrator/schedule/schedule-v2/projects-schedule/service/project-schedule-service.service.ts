import {Injectable} from '@angular/core';
import {
  IMemberIndicatorContextMenuEvent,
  IMemberUpdateResponse,
  IProjectUpdateResposne,
  IScheduleProject
} from "@interfaces/schedular";
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ProjectScheduleService {
  public width = 0;
  public top = 0;
  public left = 0;
  public opacity = 0;
  public transition = 0.15;

  public innerLoading = false;

  public highlighterLeft = 0;
  public highlighterWidth = 0;

  projects: IScheduleProject[] = [];

  private readonly contextMenuSbj$ = new Subject<IMemberIndicatorContextMenuEvent>();
  private readonly projectRefresh$Sbj = new Subject<{
    projectId: string,
    indicatorOffset: number,
    indicatorWidth: number
  }>();
  private readonly scheduleRefresh$Sbj = new Subject<{ projectId: string, teamMemberId: string }>();
  private readonly scheduleProjectRefresh$Sbj = new Subject<{ projectId: string, teamMemberId: string, isProjectRefresh: boolean }>();
  private readonly resetAllocator$Sbj = new Subject<void>();
  private readonly projectToggle$Sbj = new Subject<string>();
  private readonly reload$Sbj = new Subject<void>();

  get onProjectIndicatorChange() {
    return this.projectRefresh$Sbj.asObservable();
  }

  get onMemberIndicatorChange() {
    return this.scheduleRefresh$Sbj.asObservable();
  }

  get onMemberProjectIndicatorChange() {
    return this.scheduleProjectRefresh$Sbj.asObservable();
  }

  get onResetAllocator() {
    return this.resetAllocator$Sbj.asObservable();
  }

  get onContextMenu$() {
    return this.contextMenuSbj$.asObservable();
  }

  get onProjectToggle$() {
    return this.projectToggle$Sbj.asObservable();
  }

  get onReload() {
    return this.reload$Sbj.asObservable();
  }

  public emitProjectToggle(projectId: string) {
     this.projectToggle$Sbj.next(projectId);
  }

  public emitOnContextMenu(event: MouseEvent, projectId: string, teamMemberId: string, ids: string[]) {
    this.contextMenuSbj$.next({event, projectId, teamMemberId , ids});
  }

  public emitProjectIndicatorChange(projectId: string, indicatorOffset: number, indicatorWidth: number) {
    this.projectRefresh$Sbj.next({projectId, indicatorOffset, indicatorWidth});
  }

  public emitMemberIndicatorChange(projectId: string, teamMemberId: string) {
    this.scheduleRefresh$Sbj.next({projectId, teamMemberId});
  }

  public emitMemberProjectIndicatorChange(projectId: string, teamMemberId: string, isProjectRefresh: boolean) {
    this.scheduleProjectRefresh$Sbj.next({projectId, teamMemberId, isProjectRefresh});
  }

  public emitResetAllocator() {
    this.resetAllocator$Sbj.next();
  }

  public emitReload() {
    this.reload$Sbj.next();
  }

  toggleProject(projectId: string) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    project.is_expanded = !project.is_expanded;

    this.emitProjectToggle(projectId);

  }

  updateMemberAllocation(projectId: string, teamMemberId: string, response: IMemberUpdateResponse) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    response.project_allocation.indicator_offset = response.project_allocation.indicator_offset ? response.project_allocation.indicator_offset : 0;
    response.project_allocation.indicator_width = response.project_allocation.indicator_width ? response.project_allocation.indicator_width : 0;

    this.emitProjectIndicatorChange(projectId, response.project_allocation.indicator_offset, response.project_allocation.indicator_width)

    const member = project.members.find(m => m.team_member_id === teamMemberId);
    if (!member) return;

    member.allocations = response.member_allocations;

    this.emitResetAllocator();

  }

  updateProjectAllocation(projectId: string, response: IProjectUpdateResposne) {
    const project= this.projects.find(p => p.id === projectId);
    if (!project) return;

    response.project_allocation.indicator_offset = response.project_allocation.indicator_offset ? response.project_allocation.indicator_offset : 0;
    response.project_allocation.indicator_width = response.project_allocation.indicator_width ? response.project_allocation.indicator_width : 0;

    this.emitProjectIndicatorChange(projectId, response.project_allocation.indicator_offset, response.project_allocation.indicator_width)

    this.emitResetAllocator();

  }

}
