import {ChangeDetectorRef, Component, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import {ProjectMembersApiService} from "@api/project-members-api.service";
import {IProjectMemberViewModel} from "@interfaces/task-form-view-model";
import {TeamMembersAutocompleteComponent} from "../team-members-autocomplete/team-members-autocomplete.component";
import {log_error} from "@shared/utils";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {NzListModule} from "ng-zorro-antd/list";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NgForOf, NgIf} from "@angular/common";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {TaskListV2Service} from "../../modules/task-list-v2/task-list-v2.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {ProjectFormService} from "@services/project-form-service.service";
import {AuthService} from "@services/auth.service";
import {ProjectsService} from "../../projects/projects.service";

@Component({
  selector: 'worklenz-project-members-form',
  templateUrl: './project-members-form.component.html',
  styleUrls: ['./project-members-form.component.scss'],
  imports: [
    NzSpinModule,
    NzListModule,
    NzDrawerModule,
    NgIf,
    NzToolTipModule,
    NzTypographyModule,
    NgForOf,
    NzPopconfirmModule,
    NzFormModule,
    NzButtonModule,
    NzIconModule,
    TeamMembersAutocompleteComponent,
    NzAvatarModule,
    FirstCharUpperPipe,
    SafeStringPipe
  ],
  standalone: true
})
export class ProjectMembersFormComponent {
  @ViewChild(TeamMembersAutocompleteComponent) teamMembersAutocomplete!: TeamMembersAutocompleteComponent;

  @Input() show = false;
  @Output() showChange = new EventEmitter<boolean>();
  @Output() onUpdate = new EventEmitter();

  @Input() projectId: string | null = null;
  @Input() isProjectManager = false;

  loading = false;
  autofocus = false;

  members: IProjectMemberViewModel[] = [];
  isProjectManagerAndAdmin = false;

  constructor(
    private readonly api: ProjectMembersApiService,
    private readonly list: TaskListV2Service,
    private readonly projectFormService: ProjectFormService,
    private cdr: ChangeDetectorRef,
    private readonly auth: AuthService
  ) {
    this.list.onInviteClick$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.autofocus = true;
        this.show = true;
        this.showChange.emit(true);
      });
  }

  closeModal() {
    this.projectFormService.emitMemberAssignOrRemoveReProject();
    this.autofocus = false;
    this.show = false;
    this.showChange.emit(false);
  }

  adminAndManager() {
    if(this.isProjectManager && this.auth.isOwnerOrAdmin()) {
      return this.isProjectManagerAndAdmin = false
    }
    if(this.isProjectManager && !this.auth.isOwnerOrAdmin()) {
      return  this.isProjectManagerAndAdmin = true
    }
    return false;
  }

  async getMembers() {
    if (!this.projectId) return;
    try {
      this.loading = true;
      const res = await this.api.getByProjectId(this.projectId);
      if (res.done) {
        this.members = res.body;
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
    this.cdr.markForCheck();
  }

  async addMember(teamMemberId: string) {
    if (!teamMemberId || !this.projectId) return;
    try {
      this.teamMembersAutocomplete.reset();
      const res = await this.api.create({team_member_id: teamMemberId, project_id: this.projectId});
      if (res.done) {
        this.onUpdate?.emit();
        void this.getMembers();
        this.projectFormService.emitMemberAssignOrRemoveReProject();
      }
    } catch (e) {
      log_error(e);
    }
    this.cdr.markForCheck();
  }

  onVisibleChange(visible: boolean) {
    if (visible) {
      void this.getMembers();
    }
  }

  membersChange(memberId: string | string[]) {
    if (Array.isArray(memberId) && !memberId.length) return;
    const id = (Array.isArray(memberId) && memberId.length) ? memberId[0] : memberId;
    if (id) {
      void this.addMember(id as string);
      this.cdr.markForCheck();
    }
  }

  async removeMember(id?: string) {
    if (!id) return;
    try {
      const res = await this.api.deleteById(id, this.projectId as string);
      if (res.done) {
        this.onUpdate?.emit();
        await this.getMembers();
        this.projectFormService.emitMemberAssignOrRemoveReProject();
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
    }
  }

  trackById(index: number, item: IProjectMemberViewModel) {
    return item.id;
  }
}
