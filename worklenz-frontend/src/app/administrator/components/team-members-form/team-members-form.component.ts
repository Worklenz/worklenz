import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {ITeamMemberCreateRequest} from "@interfaces/api-models/team-member-create-request";
import {AppService} from "@services/app.service";
import {AuthService} from "@services/auth.service";
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {log_error} from "@shared/utils";
import {AvatarNamesMap} from "@shared/constants";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {JobTitlesAutocompleteComponent} from "../job-titles-autocomplete/job-titles-autocomplete.component";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {DatePipe, NgIf} from "@angular/common";
import {NzFormModule} from "ng-zorro-antd/form";
import {FromNowPipe} from "../../../pipes/from-now.pipe";
import {SettingsService} from "../../settings/settings.service";

@Component({
  selector: 'worklenz-team-members-form',
  templateUrl: './team-members-form.component.html',
  styleUrls: ['./team-members-form.component.scss'],
  imports: [
    NzSelectModule,
    NzDrawerModule,
    NzSpinModule,
    JobTitlesAutocompleteComponent,
    NzAvatarModule,
    NzTypographyModule,
    NzButtonModule,
    NzToolTipModule,
    NgIf,
    NzFormModule,
    ReactiveFormsModule,
    FromNowPipe,
    DatePipe
  ],
  standalone: true
})
export class TeamMembersFormComponent {

  form!: FormGroup;

  model: ITeamMemberViewModel = {};

  @Input() memberId: string | null = null;

  @Input() show = false;
  @Output() showChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  @Output() onCreateOrUpdate: EventEmitter<number> = new EventEmitter<number>();
  @Output() onCancel: EventEmitter<any> = new EventEmitter<any>();

  jobTitle: string | null = null;
  loading = true;
  jobTitlesLoading = false;
  resending = false;
  resentSuccess = false;

  constructor(
    private api: TeamMembersApiService,
    private fb: FormBuilder,
    private app: AppService,
    private auth: AuthService
  ) {
    this.form = this.fb.group({
      email: [null, Validators.required],
      access: ['member', Validators.required]
    });
  }

  get title() {
    return this.isEditMember() ? (this.model.name || 'Edit Member') : 'Add Member';
  }

  get okButtonText() {
    return this.isEditMember() ? 'Update' : 'Add to team';
  }

  get email() {
    return this.form.value.email;
  }

  isOwnAccount() {
    return this.auth.getCurrentSession()?.email === this.model.email;
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  async getTeamMember() {
    if (!this.memberId) {
      this.loading = false;
      return;
    }

    try {
      this.loading = true;
      const res = await this.api.getById(this.memberId);
      if (res.done) {
        this.model = res.body;

        this.form.patchValue(res.body);
        this.form.controls["access"].setValue(res.body.is_admin ? "admin" : "member");

        if (this.model.email)
          this.form.controls["email"].disable();
        if (this.isOwnAccount()) {
          this.form.controls["access"].disable();
        }
        this.jobTitle = res.body.job_title as string;
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
  }

  init() {
    this.form.reset();
    this.form.controls["email"].enable();
    this.form.controls["access"].enable();
    this.form.controls["access"].setValue('member');
    this.model = {};
    this.getTeamMember();
  }

  handleCancel() {
    this.reset();
    this.onCancel.emit();
  }

  isEditMember() {
    return !!this.memberId;
  }

  async handleOk() {
    if (this.isEditMember()) {
      await this.updateMember();
    } else {
      await this.createMember();
    }
  }

  isLoading() {
    return this.loading;
  }

  visibilityChange(visible: boolean) {
    if (visible) {
      this.init();
    }
  }

  canDisplayTitles() {
    return this.isEditMember() ? !this.loading : true;
  }

  public async resendInvitation() {
    if (!this.memberId || this.resending) return;
    try {
      this.resending = true;
      const res = await this.api.resendInvitation(this.memberId);
      if (res.done)
        this.resentSuccess = true;
      this.resending = false;
    } catch (e) {
      log_error(e);
      this.resending = false;
    }
  }

  isResendAvailable() {
    return this.model.pending_invitation && this.memberId && !this.resentSuccess;
  }

  private isAdmin() {
    return this.form.value.access === "admin";
  }

  private reset() {
    this.form.reset();
    this.show = false;
    this.jobTitle = null;
    this.loading = true;
    this.showChange?.emit(this.show);
  }

  private async updateMember() {
    if (!this.memberId) return;
    this.form.value.is_admin = !!this.form.value.is_admin;

    if (this.form.valid) {
      try {
        this.loading = true;
        const body: ITeamMemberCreateRequest = {
          job_title: this.jobTitle,
          emails: this.form.controls['email'].value,
          is_admin: this.isAdmin()
        };

        const res = await this.api.update(this.memberId, body);
        if (res.done) {
          this.reset();
          this.onCreateOrUpdate?.emit(0);
        }
        this.loading = false;
      } catch (e) {
        log_error(e);
        this.loading = false;
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }

  }

  private async createMember() {
    this.form.value.is_admin = !!this.form.value.is_admin;
    if (this.form.valid) {
      try {
        this.loading = true;
        const body: ITeamMemberCreateRequest = {
          job_title: this.jobTitle,
          emails: this.form.controls['email'].value,
          is_admin: this.isAdmin()
        };
        const res = await this.api.create(body);
        if (res.done) {
          this.reset();
          this.onCreateOrUpdate?.emit(1);
        }
        this.loading = false;
      } catch (e) {
        log_error(e);
        this.loading = false;
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }
}
