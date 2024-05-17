import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {TaskViewService} from "../task-view.service";
import {ITaskCommentViewModel} from "@interfaces/api-models/task-comment-view-model";
import {TaskCommentsApiService} from "@api/task-comments-api.service";
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";
import {EventTaskCommentCreate} from "@shared/events";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-view-comments',
  templateUrl: './task-view-comments.component.html',
  styleUrls: ['./task-view-comments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewCommentsComponent implements OnInit, OnDestroy {
  @ViewChild("commentsView", {static: false}) commentsView!: ElementRef<HTMLElement>;

  loading = true;
  comments: ITaskCommentViewModel[] = [];

  get taskId() {
    return this.service.model.task?.id;
  }

  constructor(
    private readonly commentsApi: TaskCommentsApiService,
    private readonly service: TaskViewService,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    public readonly utils: UtilsService,
  ) {
  }

  ngOnInit(): void {
    void this.get();
  }

  ngOnDestroy() {
    this.comments = [];
  }

  @HostListener(`document:${EventTaskCommentCreate}`)
  private async refreshComments() {
    await this.get(false);
    this.scrollIntoView();
  }

  canDelete(userId?: string) {
    if (!userId) return false;
    return userId === this.auth.getCurrentSession()?.id;
  }

  async get(loading = true) {
    if (!this.taskId) return;
    try {
      if (loading)
        this.loading = true;
      const res = await this.commentsApi.getByTaskId(this.taskId);
      if (res.done) {
        this.comments = res.body;
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }

    this.cdr.detectChanges();
  }

  trackById(index: number, comment: ITaskCommentViewModel) {
    return comment.id;
  }

  async deleteComment(id?: string) {
    if (!this.taskId || !id) return;
    try {
      const res = await this.commentsApi.delete(id, this.taskId);
      if (res.done) {
        await this.get(false);
        this.service.emitCommentsChange(this.taskId, this.comments.length);
        this.cdr.detectChanges();
      }
    } catch (e) {
      log_error(e);
    }
  }

  public scrollIntoView() {
    this.commentsView?.nativeElement.scrollIntoView();
  }
}
