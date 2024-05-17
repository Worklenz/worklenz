import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy} from '@angular/core';
import {SubTasksApiService} from '@api/sub-tasks-api.service';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {ISubTask} from '@interfaces/sub-task';
import {log_error} from '@shared/utils';
import {Socket} from 'ngx-socket-io';
import {KanbanV2Service} from '../../../kanban-view-v2.service';
import {Subject, takeUntil} from 'rxjs';
import {TaskListV2Service} from 'app/administrator/modules/task-list-v2/task-list-v2.service';

@Component({
  selector: 'worklenz-kanban-task-subtask-count',
  templateUrl: './task-subtask-count.component.html',
  styleUrls: ['./task-subtask-count.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskSubtaskCountComponent implements OnDestroy {
  @Input() task: IProjectTask = {};
  count: number | null = null;
  subTasks: ISubTask[] = [];
  loadingSubTasks = false;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly subTasksApi: SubTasksApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly kanbanService: KanbanV2Service,
    public readonly service: TaskListV2Service,
  ) {

    this.kanbanService.onDeleteSubTask
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.handelSubtaskDelete(value)
      });

    this.kanbanService.onCreateSubTask
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  handelSubtaskDelete(value: IProjectTask) {
    if (this.task.id === value.parent_task_id && this.task.sub_tasks_count) {
      this.task.sub_tasks_count = Math.max(+this.task.sub_tasks_count - 1, 0);
      // this.task.sub_tasks_count = this.task.sub_tasks_count - 1;
    }
    this.cdr.markForCheck();
  }

  async getSubTasks(id?: string) {
    if (!id) return;
    try {
      this.subTasks = [];
      this.loadingSubTasks = true;
      const res = await this.subTasksApi.getNames(id);
      if (res.done) {
        this.subTasks = res.body;
      }
      this.loadingSubTasks = false;
    } catch (e) {
      log_error(e);
      this.loadingSubTasks = false;
    }

    this.cdr.markForCheck();
  }

  trackByFn(index: number, data: any) {
    return data.id;
  }
}
