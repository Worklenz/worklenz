import {Component, OnInit} from '@angular/core';
import {TeamsApiService} from "@api/teams-api.service";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ProfileSettingsApiService} from "@api/profile-settings-api.service";
import {ITeamGetResponse} from "@interfaces/api-models/team-get-response";
import {AppService} from "@services/app.service";
import {MenuService} from "@services/menu.service";
import {log_error} from "@shared/utils";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss']
})
export class TeamsComponent implements OnInit {
  form!: FormGroup;
  teams: ITeamGetResponse[] = [];
  currentTeam: ITeamGetResponse | null = null;

  loading = false;
  updating = false;
  showTeamEditModal = false;

  private editingTeamId: string | null = null;

  constructor(
    private teamsApi: TeamsApiService,
    private settingsApi: ProfileSettingsApiService,
    private fb: FormBuilder,
    private app: AppService,
    public menu: MenuService,
    private readonly auth: AuthService
  ) {
    this.app.setTitle("Teams");
    this.form = this.fb.group({
      name: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.getTeams();
  }

  async getTeams() {
    try {
      this.loading = true;
      const res = await this.teamsApi.get();
      if (res.done) {
        this.teams = res.body.filter(t => t.id !== this.auth.getCurrentSession()?.team_id);
        this.currentTeam = res.body.filter(t =>  t.id === this.auth.getCurrentSession()?.team_id)[0];
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
  }

  async updateTeamName(id: string, name: string) {
    try {
      if (!id || !name) return;
      this.updating = true;
      const res = await this.settingsApi.updateTeamName(id, {name});
      if (res.done) {
        window.location.reload();
      } else {
        this.updating = false;
      }
    } catch (e) {
      this.updating = false;
      log_error(e);
    }
  }

  closeModal() {
    this.showTeamEditModal = false;
    this.editingTeamId = null;
    this.form.reset();
  }

  async handleOk() {
    if (this.form.valid && this.editingTeamId) {
      await this.updateTeamName(this.editingTeamId, this.form.controls["name"].value);
    }
  }

  editTeam(team: ITeamGetResponse | undefined) {
    if (!team || !team.id) return;
    this.showTeamEditModal = true;
    this.editingTeamId = team.id;
    this.form.controls["name"].setValue(team.name);
  }
}
