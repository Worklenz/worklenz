import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators
} from "@angular/forms";
import {AppService} from "@services/app.service";
import {AuthService} from "@services/auth.service";
import {Router} from "@angular/router";
import {log_error, smallId} from "@shared/utils";
import {ProfileSettingsApiService} from "@api/profile-settings-api.service";
import {EMAIL_REGEXP, WHITESPACE_REGEXP} from "@shared/constants";
import {
  ProjectTemplateImportDrawerComponent
} from "@admin/components/project-template-import-drawer/project-template-import-drawer.component";
import {ProjectTemplateApiService} from "@api/project-template-api.service";

export interface IAccountSetupRequest {
  team_name?: string;
  project_name?: string;
  tasks: string[];
  team_members: string[];
}

export interface IAccountSetupResponse {
  id?: string;
  has_invitations?: boolean;
}

@Component({
  selector: 'worklenz-account-setup',
  templateUrl: './account-setup.component.html',
  styleUrls: ['./account-setup.component.scss']
})
export class AccountSetupComponent implements OnInit, AfterViewInit {
  @ViewChild(ProjectTemplateImportDrawerComponent) projectTemplateDrawer!: ProjectTemplateImportDrawerComponent;

  form!: FormGroup;

  inputsMap: { [x: number]: string } = {};
  validateForm!: FormGroup;
  validateFormMember!: FormGroup;
  loading = false;
  verifying = false;

  readonly teamNameId = smallId(6);
  readonly projectNameId = smallId(6);
  readonly emailInputId = smallId(6);

  skipInviteClicked = false;
  selectedTemplateId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private app: AppService,
    private auth: AuthService,
    private api: ProfileSettingsApiService,
    private templateApi: ProjectTemplateApiService,
    private router: Router
  ) {
    this.form = this.fb.group({
      team_name: [null, [Validators.required, Validators.pattern(WHITESPACE_REGEXP)]],
      project_name: [null, [Validators.required, Validators.pattern(WHITESPACE_REGEXP)]],
      tasks: this.fb.array([], [Validators.minLength(1), Validators.pattern(WHITESPACE_REGEXP)]),
      team_members: this.fb.array([], [Validators.minLength(1), this.validEmail(EMAIL_REGEXP)])
    })
    this.app.setTitle('Setup your account');
  }

  get profile() {
    return this.auth.getCurrentSession();
  }

  get teamSetupPlaceholder() {
    return `e.g., ${this.profile?.name}'s Team`;
  }

  get projectName() {
    return this.form.value.project_name;
  }

  get workspaceName() {
    return this.form.value.team_name;
  }

  _index = 0;

  get index() {
    return this._index;
  }

  set index(i) {
    this._index = i;
  }

  get getTaskControls() {
    return <FormArray>this.form.get('tasks');
  }

  get getTasks() {
    return this.form.controls['tasks'] as FormArray;
  }

  get getTeamMemberControls() {
    return <FormArray>this.form.get('team_members');
  }

  get getTeamMembers() {
    return this.form.controls['team_members'] as FormArray;
  }

  ngOnInit(): void {
    void this.reauthorize();
    this.validateForm = this.fb.group({});
    this.validateFormMember = this.fb.group({});
    this.addNewTaskRow();
    this.addNewTeamMemberRow();
  }

  ngAfterViewInit() {
    this.inputsMap = {
      0: this.teamNameId,
      1: this.projectNameId,
      2: 'task-name-input-0',
      3: this.emailInputId
    };

    this.focusInput();
  }

  public async submit() {
    if (this.loading) return;
    try {
      this.loading = true;
      const model = this.form.value;

      model.tasks = model.tasks.filter((t: any) => t?.trim().length);
      model.template_id = this.selectedTemplateId;

      let res: any;
      if (model.template_id) {
        res = await this.templateApi.setupAccount(model);
      } else {
        res = await this.api.setupAccount(model);
      }

      await this.auth.authorize();
      if (res.done && res.body.id) {
        await this.auth.authorize();

        const url = (res.body.has_invitations)
          ? `/worklenz/setup/teams`
          : `/worklenz/projects/${res.body.id}`;
        await this.router.navigate([url]);
      }

      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
  }

  previous() {
    if (this.index > 0) {
      this.index -= 1;
    }
  }

  next() {
    if (!this.isValid()) return;

    if ((this.index + 1) > 3) {
      void this.submit();
    } else {
      this.index++;
      this.focusInput();
    }
  }

  onIndexChange(index: number) {
    this.index = index;
    this.focusInput();
  }

  validEmail(pattern: RegExp): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      let valid = false;
      if (Array.isArray(control.value)) {
        valid = control.value.every(email => pattern.test(email));
      } else {
        valid = pattern.test(control.value);
      }
      return valid ? null : {email: {value: control.value}};
    };
  }

  isValidTasksInput() {
    if (this.getTasks.length && this.getTasks.valid) return true;
    return this.getTasks.valid;
  }

  isValidTeamMembers() {
    return this.getTeamMembers.length && this.getTeamMembers.valid;
  }

  isValid() {
    if (this.index === 0) return this.form.controls["team_name"].valid;
    if (this.index === 1) return this.form.controls["project_name"].valid;
    if (this.index === 2) return this.isValidTasksInput();
    if (this.index === 3) return this.isValidTeamMembers();
    return false;
  }

  addNewTaskRow(event?: MouseEvent): void {
    if (event) event.preventDefault();
    const emptyTaskInput = new FormControl(null, [Validators.required]);
    this.getTasks.push(emptyTaskInput);
    // Focus new input
    setTimeout(() => {
      const element = document.querySelector(`#task-name-input-${this.getTaskControls.controls.length - 1}`) as HTMLInputElement;
      element?.focus();
    }, 100);
  }

  removeTaskRow(i: number, e: MouseEvent): void {
    e.preventDefault();
    const tasks = this.getTasks;
    if (tasks.length > 1) {
      tasks.removeAt(i);
    }
  }

  addNewTeamMemberRow(e?: MouseEvent): void {
    if (e) {
      e.preventDefault();
    }

    const teamMembers = this.getTeamMembers;
    const teamMemberForm = new FormControl('', [Validators.email]);

    teamMembers.push(teamMemberForm);
  }

  removeTeamMember(i: number, e: MouseEvent): void {
    e.preventDefault();
    const teamMembers = this.getTeamMembers;
    if (teamMembers.length > 1) {
      teamMembers.removeAt(i);
    }
  }

  isTeamNameValid() {
    return this.form.controls["team_name"].valid
  }

  isProjectNameValid() {
    return this.form.controls["project_name"].valid
  }

  private async reauthorize() {
    this.verifying = true;
    await this.auth.authorize();
    if (this.auth.getCurrentSession()?.setup_completed)
      return this.router.navigate(['/worklenz/home']);
    this.verifying = false;
    return null;
  }

  private focusInput() {
    setTimeout(() => {
      const id = this.inputsMap[this.index];
      const element = document.querySelector(`#${id}`) as HTMLInputElement;
      element?.focus();
    }, 250);
  }

  skipInvite() {
    this.skipInviteClicked = false;
    this.form.controls['team_members'].reset([]);
    void this.submit();
  }

  openTemplateSelector() {
    this.projectTemplateDrawer.open();
  }

  templateSelected(event: any) {
    this.selectedTemplateId = event.template_id;
    this.submit();
  }

}
