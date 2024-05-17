import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
import {AppService} from "@services/app.service";
import {AuthService} from "@services/auth.service";
import {IProjectViewModel} from "@interfaces/api-models/project-view-model";
import {ProjectFormModalComponent} from 'app/administrator/components/project-form-modal/project-form-modal.component';
import {MyProjectsComponent} from './my-projects/my-projects.component';
import {TaskListV2Service} from "../../modules/task-list-v2/task-list-v2.service";
import {
  ProjectTemplateImportDrawerComponent
} from "@admin/components/project-template-import-drawer/project-template-import-drawer.component";
import {Router} from "@angular/router";

@Component({
  selector: 'worklenz-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  @ViewChild(ProjectFormModalComponent) projectsForm!: ProjectFormModalComponent;
  @ViewChild(MyProjectsComponent) myProjects!: MyProjectsComponent;
  @ViewChild(ProjectTemplateImportDrawerComponent) projectTemplateDrawer!: ProjectTemplateImportDrawerComponent;

  greetingTime!: string;
  greetingTimer: number | null = null;

  loadingProjects = false;

  projects: IProjectViewModel[] = [];

  currentDate: Date = new Date();

  get profile() {
    return this.auth.getCurrentSession();
  }

  get name() {
    const n = this.profile?.name;
    const chunks = n?.split(' ') || [];
    return chunks[0] || chunks.join("");
  }

  constructor(
    private readonly app: AppService,
    private readonly auth: AuthService,
    private readonly listService: TaskListV2Service,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
  ) {
    this.app.setTitle("Home");
  }

  ngOnInit() {
    this.listService.setCurrentGroup(this.listService.GROUP_BY_OPTIONS[0]);
    this.greetingTime = this.getGreetingTime();
    this.startGreetingTimer();
  }

  isOwnerOrAdmin() {
    return this.profile?.owner || this.profile?.is_admin;
  }

  openProjectForm(id?: string) {
    this.projectsForm?.open(id, !!id);
    this.cdr.markForCheck();
  }

  newProjectCreated() {
    this.myProjects.getProjects();
    this.cdr.markForCheck();
  }

  getGreetingTime() {
    const splitAfternoon = 12; // 24hr time to split the afternoon
    const splitEvening = 17; // 24hr time to split the evening
    const currentHour = new Date().getHours();

    if (currentHour >= splitAfternoon && currentHour <= splitEvening) {
      // Between 12 PM and 5PM
      return 'Good afternoon';
    } else if (currentHour >= splitEvening) {
      // Between 5PM and Midnight
      return 'Good evening';
    }
    // Between dawn and noon
    return 'Good morning';
  }

  private startGreetingTimer() {
    clearTimeout(this.greetingTimer as number);
    clearInterval(this.greetingTimer as number);
    setTimeout(() => {
      this.greetingTime = this.getGreetingTime();
    }, 1000);
    this.cdr.markForCheck();
  }

  openTemplateSelector() {
    this.projectTemplateDrawer.open();
    this.cdr.markForCheck();
  }

  goToProjects(event: any) {
    this.router.navigate([`/worklenz/projects/${event}`]);
  }
}
