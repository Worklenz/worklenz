import {Component, OnInit} from '@angular/core';
import {TeamsApiService} from "@api/teams-api.service";
import {log_error} from "@shared/utils";
import {ITeamGetResponse} from "@interfaces/api-models/team-get-response";
import {ITeamInvites} from "@interfaces/team";
import {AuthService} from "@services/auth.service";
import {Router} from "@angular/router";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {AppService} from "@services/app.service";

interface ITeamViewModel extends ITeamGetResponse {
  active?: boolean;
  pending_invitation?: boolean;
}

@Component({
  selector: 'worklenz-teams-list',
  templateUrl: './teams-list.component.html',
  styleUrls: ['./teams-list.component.scss']
})
export class TeamsListComponent implements OnInit {
  teams: ITeamViewModel[] = [];
  invites: ITeamInvites[] = [];

  selectedTeamId: string | undefined = undefined;

  loading = false;
  switching = false;
  isInvitation = false;

  constructor(
    private readonly app: AppService,
    private readonly auth: AuthService,
    private readonly teamsApi: TeamsApiService,
    private readonly router: Router
  ) {
    this.app.setTitle("Teams & Invitations");
  }

  ngOnInit() {
    void this.getData();
  }

  private updateDefaultSelection() {
    if (this.teams.length) {
      const activeTeam = this.teams.find(t => t.active);
      if (activeTeam) {
        this.selectedTeamId = activeTeam.id;
      } else {
        this.selectedTeamId = this.teams[0].id;
      }
    } else if (this.invites.length) {
      this.selectedTeamId = this.invites[0].team_id;
    }
  }

  private async getData() {
    this.loading = true;
    await this.getTeams();
    await this.getInvites();
    this.updateDefaultSelection();
    this.loading = false;
  }

  private async getTeams() {
    try {
      const res: IServerResponse<ITeamViewModel[]> = await this.teamsApi.get();
      if (res.done) {
        this.teams = res.body.filter(t => !t.pending_invitation);
      }
    } catch (e) {
      log_error(e);
    }
  }

  private async getInvites() {
    try {
      const res = await this.teamsApi.getInvites();
      if (res.done) {
        this.invites = res.body;
      }
    } catch (e) {
      log_error(e);
    }
  }

  selectTeam(id: string | undefined, isInvitation: boolean) {
    if (id) {
      this.selectedTeamId = id;
      this.isInvitation = isInvitation;
    }
  }

  async continueWithSelection() {
    if (this.selectedTeamId) {
      try {
        this.switching = true;

        if (this.isInvitation) {
          const accepted = await this.acceptInvitation();
          if (!accepted) {
            this.switching = false;
            this.app.notify("Request failed!", "Invitation accept failed. Please try again.", false);
            return;
          }
        }

        const res = await this.teamsApi.activate(this.selectedTeamId);
        if (res.done) {
          await this.handleSelectionDone();
        }
        this.switching = false;
      } catch (e) {
        this.switching = false;
      }
    }
  }

  private async handleSelectionDone() {
    await this.auth.authorize();
    await this.router.navigate(["/worklenz"]);
  }

  private async acceptInvitation() {
    const invitation = this.invites.find(i => i.team_id === this.selectedTeamId);
    if (invitation) {
      const res = await this.teamsApi.accept({team_member_id: invitation.team_member_id});
      return res.done;
    }
    return false;
  }
}
