import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  Output,
  ViewChild
} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {ProjectsDefaultColorCodes} from "@shared/constants";
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {ITeamMember} from "@interfaces/team-member";
import {ITask} from "@interfaces/task";
import {ProjectsApiService} from "@api/projects-api.service";
import {AppService} from "@services/app.service";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {IProject} from "@interfaces/project";
import {dispatchProjectChange} from "@shared/events";
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";
import {ProjectStatusesApiService} from "@api/project-statuses-api.service";
import {IProjectStatus} from "@interfaces/project-status";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {ClientsAutocompleteComponent} from "../clients-autocomplete/clients-autocomplete.component";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzButtonModule} from "ng-zorro-antd/button";
import {DatePipe, NgForOf, NgIf} from "@angular/common";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzIconModule} from "ng-zorro-antd/icon";
import {TeamMembersFormComponent} from "../team-members-form/team-members-form.component";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {FromNowPipe} from "@pipes/from-now.pipe";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {IProjectViewModel} from "@interfaces/api-models/project-view-model";
import {NzDividerModule} from "ng-zorro-antd/divider";
import {AuthService} from "@services/auth.service";
import {NzAlertModule} from "ng-zorro-antd/alert";
import {ProjectFoldersApiService} from "@api/project-folders-api.service";
import {IProjectFolder} from "@interfaces/project-folder";
import {
  ProjectFoldersAutocompleteComponent
} from "@admin/components/project-folders-autocomplete/project-folders-autocomplete.component";
import {
  ProjectsFolderFormDrawerService
} from "../../projects/projects/projects-folder-form-drawer/projects-folder-form-drawer.service";
import {
  ProjectCategoriesAutocompleteComponent
} from "@admin/components/project-categories-autocomplete/project-categories-autocomplete.component";
import {ProjectFormService} from "@services/project-form-service.service";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {IProjectHealth} from "@interfaces/project-health";
import {ProjectHealthsApiService} from "@api/project-healths-api.service";
import moment from "moment";
import {NzInputNumberModule} from "ng-zorro-antd/input-number";
import {AvatarsComponent} from "@admin/components/avatars/avatars.component";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {ProjectsService} from "../../projects/projects.service";

@Component({
  selector: 'worklenz-project-form-modal',
  templateUrl: './project-form-modal.component.html',
  styleUrls: ['./project-form-modal.component.scss'],
  imports: [
    NzSelectModule,
    NzDrawerModule,
    NzTagModule,
    NzSpinModule,
    ClientsAutocompleteComponent,
    ReactiveFormsModule,
    NzInputModule,
    NzButtonModule,
    NgIf,
    NzPopconfirmModule,
    NzFormModule,
    NgForOf,
    NzIconModule,
    TeamMembersFormComponent,
    NzDatePickerModule,
    NzDropDownModule,
    SafeStringPipe,
    DatePipe,
    FromNowPipe,
    NzToolTipModule,
    NzTypographyModule,
    NzDividerModule,
    NzAlertModule,
    ProjectFoldersAutocompleteComponent,
    ProjectCategoriesAutocompleteComponent,
    NzBadgeModule,
    NzInputNumberModule,
    AvatarsComponent,
    FirstCharUpperPipe,
    NzAvatarModule,
    NzCheckboxModule,
    SearchByNamePipe,
    FormsModule
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectFormModalComponent {
  @ViewChild('projectName', {static: false}) projectName!: ElementRef;
  @ViewChild('memberSearchInput', {static: false}) memberSearchInput!: ElementRef;
  @ViewChild('projectManagerSelector', {static: false}) projectManagerSelector!: ElementRef;
  @ViewChild('outsideClicker', {static: false}) outsideClicker!: ElementRef;

  form!: FormGroup;

  @Output() onCreate = new EventEmitter<IProject | null>();
  @Output() onUpdate = new EventEmitter<IProject | null>();
  @Output() onProjectManagerUpdate = new EventEmitter<void>();
  @Output() onDelete = new EventEmitter();

  readonly COLOR_CODES = ProjectsDefaultColorCodes;

  show = false;
  edit = false;
  loading = false;
  searching = false;
  showTeamMemberModal = false;
  updatingProject = false;
  deletingProject = false;
  loadingTeamMembers = false;
  loadingProjStatuses = false;
  loadingProjHealths = false;
  isMember = false;
  isManager = false;
  loadingFolders = false;

  clientName: string | null = null;
  projectManager: ITeamMemberViewModel | null = null;
  projectId: string | null = null;

  teamMembers: ITeamMemberViewModel[] = [];
  projectMembers: ITeamMemberViewModel[] = [];
  removedMembersList: ITeamMember[] = [];
  removedTasks: ITask[] = [];
  newTasks: ITask[] = [];
  statuses: IProjectStatus[] = [];
  folders: IProjectFolder[] = [];
  healths: IProjectHealth[] = [];

  public searchingName: string | null = null;
  model: IProjectViewModel = {};

  get categoryId() {
    return this.form.controls["category_id"].value || null;
  }

  set categoryId(value: string | null) {
    this.form.controls["category_id"].setValue(value);
  }

  get startDate() {
    return this.form.value.start_date || null;
  }

  get endDate() {
    return this.form.value.end_date || null;
  }

  get title() {
    return this.projectId ? "Update Project" : "Create Project";
  }

  get submitButtonText() {
    return this.projectId ? "Save Changes" : "Create";
  }

  get activeColorCode() {
    return this.form.controls['color_code'].value;
  }

  constructor(
    private readonly api: ProjectsApiService,
    private readonly fb: FormBuilder,
    private readonly membersApi: TeamMembersApiService,
    private readonly app: AppService,
    private readonly statusesApi: ProjectStatusesApiService,
    private readonly auth: AuthService,
    private readonly ngZone: NgZone,
    private readonly foldersApi: ProjectFoldersApiService,
    private readonly folderFormService: ProjectsFolderFormDrawerService,
    private readonly cdr: ChangeDetectorRef,
    public readonly utils: UtilsService,
    private readonly projectFormService: ProjectFormService,
    private readonly healthsApi: ProjectHealthsApiService,
    private readonly projectsService: ProjectsService
  ) {
    this.createForm();
  }

  private createForm() {
    this.form = this.fb.group({
      name: [null, [Validators.required]],
      key: [null, [Validators.max(5)]],
      notes: [null, []],
      start_date: [],
      project_manager: [null, []],
      end_date: [],
      status_id: [],
      health_id: [],
      folder_id: [],
      category_id: [],
      color_code: [ProjectsDefaultColorCodes[1], [Validators.required]],
      working_days: [0, [Validators.required]],
      man_days: [0, [Validators.required]],
      hours_per_day: [8, [Validators.required]],
      // Internal use
      _select_team_member_input: [null, []]
    });

    if (this.isMember) {
      this.form.disable();
    }

    this.form.controls["_select_team_member_input"]
      .valueChanges.subscribe((value) => {
      this.searchingName = value;
      void this.searchMembers();
    });
  }

  reset() {
    this.clientName = null;
    this.projectId = null;
    this.projectManager = null;
    this.teamMembers = [];
    this.projectMembers = [];
    this.removedMembersList = [];
    this.removedTasks = [];
    this.newTasks = [];
    this.deletingProject = false;
    this.updatingProject = false;
  }

  handleClose() {
    this.reset();
    this.show = false;
  }

  isOwnerOrAdmin() {
    return this.auth.getCurrentSession()?.owner || this.auth.getCurrentSession()?.is_admin;
  }

  isProjectManager() {
    if (this.projectsService.projectOwnerTeamMemberId) return this.auth.getCurrentSession()?.team_member_id === this.projectsService.projectOwnerTeamMemberId;
    return false;
  }

  public async open(id?: string, edit = false) {
    this.isMember = !this.isOwnerOrAdmin() && !this.isProjectManager();

    this.show = true;
    this.edit = edit;
    this.createForm();

    void this.getProjectStatuses();
    void this.getProjectHealths();

    if (id) {
      this.projectId = id;
      void this.get(this.projectId);
    }

    void this.getTeamMembers();
  }

  isLoading() {
    return this.loadingTeamMembers;
  }

  async getFolders() {
    try {
      this.loadingFolders = true;
      const res = await this.foldersApi.get();
      if (res.done) {
        this.folders = res.body;
      }
      this.loadingFolders = false;
    } catch (e) {
      this.loadingFolders = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  async getTeamMembers() {
    try {
      this.loadingTeamMembers = true;
      const res = await this.membersApi.get(1, 5, null, null, this.memberSearchInput ? this.memberSearchInput.nativeElement.value : null, true);
      if (res.done) {
        this.teamMembers = res.body.data || [];
        this.teamMembers = this.teamMembers.filter(m => m.active);
        this.teamMembers.sort((a, b) => {
          return Number(a.pending_invitation) - Number(b.pending_invitation);
        });
      }
      this.loadingTeamMembers = false;
    } catch (e) {
      this.loadingTeamMembers = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  async getProjectStatuses() {
    try {
      this.loadingProjStatuses = true;
      const res = await this.statusesApi.get();
      if (res.done) {
        this.statuses = res.body;
        const defaultStatus = this.statuses.find(s => s.is_default);
        // Set default status in create mode
        if (!this.projectId && defaultStatus && defaultStatus.id)
          this.form.controls["status_id"].setValue(defaultStatus.id);
      }
      this.loadingProjStatuses = false;
    } catch (e) {
      this.loadingProjStatuses = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  async getProjectHealths() {
    try {
      this.loadingProjHealths = true;
      const res = await this.healthsApi.get();
      if (res) {
        this.healths = res.body;
        const defaultHealth = this.healths.find(s => s.is_default);
        // Set default health in create mode
        if (!this.projectId && defaultHealth && defaultHealth.id)
          this.form.controls["health_id"].setValue(defaultHealth.id);
      }
      this.loadingProjHealths = false;
    } catch (e) {
      this.loadingProjHealths = false;
      log_error(e);
    }
    this.cdr.markForCheck();
  }

  async delete() {
    if (!this.projectId) return;
    try {
      this.deletingProject = true;
      const res = await this.api.delete(this.projectId);
      if (res.done) {
        this.handleClose();
        this.onDelete?.emit();
      }
      this.deletingProject = false;
    } catch (e) {
      this.deletingProject = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  async create() {
    try {
      this.updatingProject = true;
      const body = {
        name: this.form.controls['name'].value,
        client_name: this.clientName,
        notes: this.form.controls['notes'].value,
        project_manager: this.projectManager,
        color_code: this.form.controls['color_code'].value,
        status_id: this.form.controls['status_id'].value,
        health_id: this.form.controls['health_id'].value,
        start_date: this.form.controls["start_date"].value,
        end_date: this.form.controls["end_date"].value,
        folder_id: this.form.controls["folder_id"].value,
        category_id: this.form.controls["category_id"].value,
        working_days: this.form.controls["working_days"].value,
        man_days: this.form.controls["man_days"].value,
        hours_per_day: this.form.controls["hours_per_day"].value
      };
      const res = await this.api.create(body);
      if (res.done) {
        this.handleClose();
        this.onCreate.emit(res.body);
        dispatchProjectChange();
      }
      this.updatingProject = false;
    } catch (e) {
      this.updatingProject = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  async update(id: string) {
    try {
      this.updatingProject = true;
      const body = {
        name: this.form.controls['name'].value,
        client_name: this.clientName,
        notes: this.form.controls['notes'].value,
        project_manager: this.projectManager,
        key: this.form.controls['key'].value,
        color_code: this.form.controls['color_code'].value,
        status_id: this.form.controls['status_id'].value,
        health_id: this.form.controls['health_id'].value,
        start_date: this.form.controls["start_date"].value,
        end_date: this.form.controls["end_date"].value,
        folder_id: this.form.controls["folder_id"].value,
        category_id: this.form.controls["category_id"].value,
        working_days: this.form.controls["working_days"].value,
        man_days: this.form.controls["man_days"].value,
        hours_per_day: this.form.controls["hours_per_day"].value
      };

      const res = await this.api.update(id, body);
      if (res.done) {
        this.handleClose();
        this.onUpdate.emit(res.body);
        dispatchProjectChange();
        this.projectFormService.emitProjectUpdate();
        return true;
      }
      this.updatingProject = false;
    } catch (e) {
      this.updatingProject = false;
      log_error(e);
    }

    this.cdr.markForCheck();
    return false;
  }

  async get(id: string | undefined) {
    if (!id) return;
    try {
      this.loading = true;
      const res = await this.api.getById(id);
      if (res.done) {
        this.model = res.body;
        this.form.patchValue(this.model);
        this.clientName = res.body.client_name as string;
        this.projectManager = this.model.project_manager ? this.model.project_manager : null;
        this.projectMembers = this.model.members ?? [];
        this.newTasks = this.model.tasks ?? [];
        this.categoryId = this.model.category_id || null;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  async submit() {
    if (this.isMember) return;
    if (this.form.valid) {
      if (this.projectId) {
        const updated = await this.update(this.projectId);
        // if (updated)
        //   window.location.reload();
      } else {
        void this.create();
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }

  async searchMembers() {
    this.searching = true;
    await this.getTeamMembers();
    this.searching = false;

    this.cdr.markForCheck();
  }

  onVisibilityChange(visible: boolean) {
    if (visible) {
      void this.getFolders();
      if (this.isMember) return;
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          const element = this.projectName.nativeElement as HTMLInputElement;
          if (element)
            element.focus();
        }, 100);
      });
    }
  }

  handleOwnerVisibleChange(visible: boolean) {
    if (visible) {
      try {
        setTimeout(() => {
          this.projectManagerSelector.nativeElement.classList.add('highlight');
        }, 100)
        this.cdr.markForCheck();
      } catch (e) {
        log_error(e);
        this.cdr.markForCheck();
      }
    } else {
      this.projectManagerSelector.nativeElement.classList.remove('highlight');
      this.cdr.markForCheck();
    }
  }

  setColorCode(colorCode: string) {
    this.form.controls["color_code"].setValue(colorCode);
  }

  onNameChangeSubmit(name: string) {
    this.clientName = name || null;
  }

  onKeyChange() {
    const value = this.form.controls["key"].value;
    if (value)
      this.form.controls["key"].setValue(value.toUpperCase());
  }

  newFolder() {
    this.folderFormService.create((folder?: IProjectFolder) => {
      if (folder) {
        this.updateFolders(folder);
        this.form.controls["folder_id"]?.setValue(folder.id);
        this.cdr.markForCheck();
      }
    });
  }

  private updateFolders(folder: IProjectFolder) {
    const folders = [...this.folders];
    folders.push(folder);
    folders.sort((a, b) => a.name.localeCompare(b.name));
    this.folders = folders;
  }

  calculateManDays() {
    const start = this.form.controls["start_date"].value;
    const end = this.form.controls["end_date"].value;
    if (start && end) {
      const s = moment(start);
      const e = moment(end);
      let days = e.diff(s, "days") + 1;
      if (e.isoWeekday() > 5) days -= e.isoWeekday() % 5;
      if (s.isoWeekday() > 5) days -= (3 - (s.isoWeekday() % 5));
      if (days > 5) {
        const weeks = (days - (days % 7)) / 7;
        days -= (weeks * 2);
      }
      this.form.controls["working_days"].setValue(days);
    }
  }

  trackById(index: number, item: ITeamMemberViewModel) {
    return item.id;
  }

  handleMemberChange(item: ITeamMemberViewModel | null) {
    if (item?.pending_invitation || this.isMember || (!this.isOwnerOrAdmin() && this.isProjectManager())) return;
    this.projectManager = item;
    this.focusOut();
    this.cdr.markForCheck();
  }

  focusOut() {
    setTimeout(() => {
      this.outsideClicker.nativeElement.click();
    }, 50)
    this.cdr.markForCheck();
  }

}
