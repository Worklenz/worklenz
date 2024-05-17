import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FirstCharUpperPipe} from "../../../pipes/first-char-upper.pipe";
import {FromNowPipe} from "../../../pipes/from-now.pipe";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzCommentModule} from "ng-zorro-antd/comment";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {ProjectUpdatesInputComponent} from "../project-updates-input/project-updates-input.component";
import {IProjectUpdateCommentViewModel} from "../../../interfaces/project";
import {AuthService} from "../../../services/auth.service";
import {UtilsService} from "../../../services/utils.service";
import {ProjectCommentsApiService} from "../../../services/api/project-comments-api.service";
import {log_error} from "../../../shared/utils";
import {ProjectUpdatesService} from "@services/project-updates.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {IMentionMember, IMentionMemberViewModel} from "@interfaces/project-comments";
import {AppService} from "@services/app.service";
import {ProjectMembersApiService} from "@api/project-members-api.service";
import {IProjectCommentsCreateRequest} from "@interfaces/api-models/project-comment-create-request";
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzInputModule} from "ng-zorro-antd/input";
import {MentionOnSearchTypes, NzMentionModule} from "ng-zorro-antd/mention";
import {DomSanitizer} from "@angular/platform-browser";

@Component({
  selector: 'worklenz-project-updates-list',
  standalone: true,
  imports: [
    CommonModule,
    FirstCharUpperPipe,
    FromNowPipe,
    NzAvatarModule,
    NzCommentModule,
    NzPopconfirmModule,
    NzSkeletonModule,
    ProjectUpdatesInputComponent,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzMentionModule,
    NzSpaceModule,
    NzWaveModule,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './project-updates-list.component.html',
  styleUrls: ['./project-updates-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectUpdatesListComponent implements OnInit, OnDestroy {
  @Input() projectId: string | null = null;
  @Input() isLimit = false;

  loading = false;
  commentsInputFocused = false;
  loadingMembers = false;
  creatingComment = false;

  search: string | null = null;

  updates: IProjectUpdateCommentViewModel[] = [];
  projectMembers: IMentionMemberViewModel[] = [];
  mentions: IMentionMember[] = [];

  form!: FormGroup;

  valueWith = (data: { name: string; }): string => data.name;

  constructor(
    private readonly fb: FormBuilder,
    private readonly app: AppService,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    public readonly utils: UtilsService,
    private readonly api: ProjectCommentsApiService,
    private readonly service: ProjectUpdatesService,
  ) {
    this.form = this.fb.group({
      content: [null, [Validators.required, Validators.maxLength(2000)]]
    });

    this.service.onRefresh
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.get();
      });
  }

  ngOnInit() {
    this.get();
    this.getProjectMembers();
    this.getCount();
    this.service.emitBadgeDisable();
  }

  ngOnDestroy() {
    this.projectMembers = [];
    this.search = null;
    this.mentions = [];
  }

  get rows() {
    this.cdr.markForCheck();
    return this.commentsInputFocused ? 4 : 1;
  }

  updateLocalCount(newCount: string) {
    return localStorage.setItem("worklenz.project.updates-" + this.projectId, newCount);
  }

  async loadDataOnDrawer(projectId: string) {
    this.projectId = projectId;
    await this.get();
    await this.getProjectMembers();
    await this.getCount();
  }

  private async get() {
    if (!this.projectId) return;
    try {
      this.loading = true;
      const res = await this.api.getByProjectId(this.projectId, this.isLimit);
      if (res) {
        this.updates = res.body;
        this.loading = false;
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async getCount() {
    if (!this.projectId) return;
    try {
      const res = await this.api.getCountByProjectId(this.projectId);
      if (res) {
        this.updateLocalCount(res.body.toString());
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e)
      this.cdr.markForCheck();
    }
  }

  async getProjectMembers() {
    if (!this.projectId) return;
    try {
      this.loadingMembers = true;
      const res = await this.api.getMembers(this.projectId, 1, 5, null, null, this.search);
      if (res.done) {
        this.projectMembers = res.body || [];
      }
      this.loadingMembers = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingMembers = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  setFocus(focused: boolean) {
    this.commentsInputFocused = focused;
  }

  async create() {
    if (!this.projectId || !this.form.value.content || this.form.value.content.trim() === "") return;
    try {
      this.creatingComment = true;
      const session = this.auth.getCurrentSession();
      const body: IProjectCommentsCreateRequest = {
        project_id: this.projectId,
        team_id: session?.team_id,
        content: this.form.value.content,
        mentions: [...new Set(this.mentions || [])]
      }
      const res = await this.api.create(body);
      if (res) {
        await this.get();
        await this.getCount();
        this.service.emitGetLastUpdate();
        this.reset();
      }
      this.creatingComment = false;
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.creatingComment = false;
      this.cdr.markForCheck();
    }
  }

  onSearchChange({value}: MentionOnSearchTypes): void {
    this.search = value;
  }

  onSelect(member: IMentionMemberViewModel) {
    if (!member || !member.id || !member.name) return;
    if (!this.mentions.some(mention => mention.id === member.id))
      this.mentions.push(
        {
          id: member.id,
          name: member.name
        }
      );
  }

  cancel() {
    this.setFocus(false);
    this.form.reset();
  }

  isValid() {
    return this.form.valid;
  }

  submit() {
    if (this.form.valid) {
      this.create();
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }

  canDelete(userId?: string) {
    if (!userId) return false;
    return userId === this.auth.getCurrentSession()?.id;
  }

  async deleteComment(id?: string) {
    if (!id) return;
    try {
      const res = await this.api.deleteById(id);
      if (res) {
        await this.get();
        await this.getCount();
        this.service.emitGetLastUpdate();
      }
    } catch (e) {
      log_error(e);
    }
  }

  trackById(updateComment: IProjectUpdateCommentViewModel) {
    return updateComment.id;
  }

  reset() {
    this.mentions = [];
    this.form.reset();
    this.creatingComment = false;
  }

}
