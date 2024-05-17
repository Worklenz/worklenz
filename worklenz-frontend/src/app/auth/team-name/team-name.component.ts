import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";

import {IUserSignUpRequest} from "@interfaces/api-models/user-sign-up-request";
import {AppService} from "@services/app.service";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {AuthApiService} from "@api/auth-api.service";

@Component({
  selector: 'worklenz-team-name',
  templateUrl: './team-name.component.html',
  styleUrls: ['./team-name.component.scss']
})
export class TeamNameComponent implements OnInit {
  @Input() model: IUserSignUpRequest | null = null;
  @Output() back: EventEmitter<any> = new EventEmitter<any>();

  form!: FormGroup;

  loading = false;
  showBackButton = false;

  teamId: string | null = null;
  teamMemberId: string | null = null;

  constructor(
    private api: TeamMembersApiService,
    private authApi: AuthApiService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private app: AppService
  ) {
    this.teamId = this.route.snapshot.queryParamMap.get("team");
    this.teamMemberId = this.route.snapshot.queryParamMap.get('user');
  }

  get invitationQueryParams() {
    return this.teamId && this.teamMemberId
      ? `?team=${this.teamId}&teamMember=${this.teamMemberId}` : '';
  }

  ngOnInit() {
    this.form = this.fb.group({
      team_name: [null, [Validators.required]]
    });
  }

  async proceedRegistration() {
    this.loginWithEmail();
  }

  private async loginWithEmail() {
    if (this.loading) return;
    if (!this.model) return;

    if (this.form.valid) {
      try {
        this.loading = true;
        this.model.team_name = this.form.controls["team_name"].value;
        if (this.teamId)
          this.model.team_id = this.teamId;
        if (this.teamMemberId)
          this.model.team_member_id = this.teamMemberId;

        const res = await this.authApi.signup(this.model);

        this.showBackButton = !res.authenticated;

        if (res.authenticated) {
          await this.router.navigate(["/authenticate"]);
        }

        this.loading = false;
      } catch (e) {
        this.loading = false;
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }

}
