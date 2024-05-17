import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ITeamMember} from "@interfaces/team-member";
import {ITaskCommentViewModel} from "@interfaces/api-models/task-comment-view-model";
import {AppService} from "@services/app.service";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {TaskCommentsApiService} from "@api/task-comments-api.service";
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";
import {MentionOnSearchTypes} from "ng-zorro-antd/mention";
import {ITaskCommentsCreateRequest} from "@interfaces/api-models/task-comments-create-request.ts";
import {TaskViewService} from "../task-view.service";
import {dispatchTaskCommentCreate} from "@shared/events";
import {AuthService} from "@services/auth.service";

interface ITaskMention {
  team_member_id: string,
  name: string
}

@Component({
  selector: 'worklenz-task-view-comments-input',
  templateUrl: './task-view-comments-input.component.html',
  styleUrls: ['./task-view-comments-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class TaskViewCommentsInputComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() focusChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  form!: FormGroup;

  commentsInputFocused = false;
  loadingMembers = false;
  creatingComment = false;
  teamMembers: ITeamMember[] = [];
  search: string | null = null;
  mentions: ITaskMention[] = [];


  get taskId() {
    return this.service.model.task?.id;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly app: AppService,
    private readonly teamMembersApi: TeamMembersApiService,
    private readonly commentsApi: TaskCommentsApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly service: TaskViewService,
    public readonly utils: UtilsService,
    private readonly auth: AuthService
  ) {
    this.form = this.fb.group({
      content: [null, [Validators.required, Validators.maxLength(2000)]]
    });
  }

  get rows() {
    return this.commentsInputFocused ? 4 : 1;
  }

  valueWith = (data: { name: string; }): string => data.name;

  ngOnInit(): void {
    void this.getTeamMembers();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 10);
  }

  ngOnDestroy() {
    this.teamMembers = [];
    this.search = null;
    this.mentions = [];
  }

  async getTeamMembers() {
    try {
      this.loadingMembers = true;
      const res = await this.teamMembersApi.get(1, 100, null, null, this.search);
      if (res.done && res.body.data) {
        // for (const item of res.body.data) {
        //   if (!item.pending_invitation) {
        //     this.teamMembers.push(item);
        //   }
        // }
        this.teamMembers = res.body.data.filter(t => !t.pending_invitation);
      }
      this.loadingMembers = false;
    } catch (e) {
      this.loadingMembers = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  async create() {
    if (!this.taskId || !this.form.value.content) return;
    try {
      this.creatingComment = true;
      const body: ITaskCommentsCreateRequest = {
        task_id: this.taskId,
        content: this.form.value.content,
        mentions: [...new Set(this.mentions || [])]
      };
      const res = await this.commentsApi.create(body);
      if (res.done) {
        this.form.reset();
        this.service.emitCommentsChange(this.taskId, 1); // emit 1 as count since the variable only used to check for comments has or not
        dispatchTaskCommentCreate();
      }
      this.creatingComment = false;
    } catch (e) {
      log_error(e);
      this.creatingComment = false;
    }

    this.cdr.markForCheck();
  }

  submit() {
    if (this.form.valid) {
      this.create();
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }

  cancel() {
    this.setFocus(false);
    this.form.reset();
  }

  onSearchChange({value}: MentionOnSearchTypes): void {
    this.search = value;
    // this.teamMembers = [];
    void this.getTeamMembers();
  }

  onSelect(member: ITeamMember) {
    if (!member || !member.id || !member.name) return;
    if (!this.mentions.some(mention => mention.team_member_id === member.id))
      this.mentions.push(
        {
          team_member_id: member.id,
          name: member.name
        }
      );
  }

  trackById(index: number, comment: ITaskCommentViewModel) {
    return comment.id;
  }

  setFocus(focused: boolean, input?: HTMLTextAreaElement) {
    this.commentsInputFocused = focused;
    this.focusChange?.emit(focused);
    input?.focus();
  }

  isValid() {
    return this.form.valid;
  }
}
