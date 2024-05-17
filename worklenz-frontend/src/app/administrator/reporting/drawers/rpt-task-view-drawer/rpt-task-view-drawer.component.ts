import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {ReportingDrawersService} from "../reporting-drawers.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {IRPTTaskDrawerData} from "../../interfaces";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";

@Component({
  selector: 'worklenz-rpt-task-view-drawer',
  templateUrl: './rpt-task-view-drawer.component.html',
  styleUrls: ['./rpt-task-view-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptTaskViewDrawerComponent {
  projectId: string | null = null;
  taskId: string | null = null;

  get show() {
    return !!(this.projectId && this.taskId);
  }

  set show(value: boolean) {
    if (!value) {
      this.projectId = null;
      this.taskId = null;
    }
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly drawer: ReportingDrawersService,
    private readonly taskViewService: TaskViewService
  ) {
    this.drawer.onOpenTask
      .pipe(takeUntilDestroyed())
      .subscribe(data => {
        this.open(data);
      });

    this.taskViewService.onViewBackFrom.pipe(takeUntilDestroyed()).subscribe(task => {
      const task_: IProjectTask = {
        id: task.parent_task_id,
        project_id: task.project_id,
      }
      this.handleTaskSelectFromView(task_);
    })

    this.taskViewService.onDelete
      .pipe(takeUntilDestroyed())
      .subscribe(async task => {
        if (task.parent_task_id) {
          const task_: IProjectTask = {
            id: task.parent_task_id,
            project_id: this.projectId as string
          }
          this.handleTaskSelectFromView(task_);
        }
      })

  }

  handleTaskSelectFromView(task: IProjectTask) {
    this.show;
    setTimeout(() => {
      if (task && task.id && task.project_id) {
        const parent: IRPTTaskDrawerData = {
          taskId: task.id,
          projectId: task.project_id
        }
        this.open(parent);
      }
    }, DRAWER_ANIMATION_INTERVAL);
    this.cdr.detectChanges();
  }

  private open(data: IRPTTaskDrawerData) {
    this.taskId = data.taskId;
    this.projectId = data.projectId;
    this.cdr.markForCheck();
  }
}
