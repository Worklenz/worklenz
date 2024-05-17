import { Component, OnInit } from '@angular/core';
import { AppService } from '@services/app.service';
import { AuthService } from "@services/auth.service";
import { ISettingsNavigationItem } from "@interfaces/settings-navigation-item";

@Component({
  selector: 'worklenz-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  navigation: ISettingsNavigationItem[] = [];

  constructor(
    private auth: AuthService,
    private app: AppService
  ) {
    this.app.setTitle('Settings');
  }

  get profile() {
    return this.auth.getCurrentSession();
  }

  ngOnInit() {
    this.buildNavigation();
  }

  isOwnerOrAdmin() {
    return this.profile?.owner || this.profile?.is_admin;
  }

  private buildNavigation() {
    this.navigation = [];

    this.navigation.push({ label: 'Profile', icon: 'user', url: 'profile' });
    this.navigation.push({ label: 'Notifications', icon: 'notification', url: 'notifications' });

    if (this.isOwnerOrAdmin()) {
      this.navigation.push({ label: 'Clients', icon: 'user-switch', url: 'clients' });
      this.navigation.push({ label: 'Job Titles', icon: 'idcard', url: 'job-titles' });
      this.navigation.push({ label: 'Labels', icon: 'tags', url: 'labels' });
      this.navigation.push({ label: 'Categories', icon: 'group', url: 'categories' });
      this.navigation.push({ label: 'Project Templates', icon: 'file-zip', url: 'project-templates' });
      this.navigation.push({ label: 'Task Templates', icon: 'profile', url: 'task-templates' });
      this.navigation.push({ label: 'Team Members', icon: 'team', url: 'team-members' });


    this.navigation.push({ label: 'Teams', icon: 'bank', url: 'teams' });
    }

    if (!this.profile?.is_google)
      this.navigation.push({ label: 'Change Password', icon: 'lock', url: 'password' });

    this.navigation.push({ label: 'Language & Region', icon: 'global', url: 'language-and-region' });
  }
}
