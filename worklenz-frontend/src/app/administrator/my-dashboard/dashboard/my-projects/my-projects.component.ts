import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {ProjectsApiService} from '@api/projects-api.service';
import {IProjectViewModel} from '@interfaces/api-models/project-view-model';
import {log_error} from '@shared/utils';
import {HomePageApiService} from "@api/home-page-api.service";

@Component({
  selector: 'worklenz-my-projects',
  templateUrl: './my-projects.component.html',
  styleUrls: ['./my-projects.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyProjectsComponent implements OnInit {
  projects: IProjectViewModel[] = [];

  loading = true;
  options = ['Recent', 'Favorites'];

  private readonly myProjectsActiveFilterKey = "my-dashboard-active-projects-filter";

  get activeFilter() {
    return +(localStorage.getItem(this.myProjectsActiveFilterKey) || 0);
  }

  set activeFilter(value: number) {
    localStorage.setItem(this.myProjectsActiveFilterKey, value.toString());
  }

  constructor(
    private readonly api: ProjectsApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly homePageApi: HomePageApiService
  ) {
  }

  ngOnInit() {
    this.getProjects();
  }

  async getProjects() {
    try {
      this.loading = true;
      const res = await this.homePageApi.getProjects(this.activeFilter);
      if (res) {
        this.projects = res.body;
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  handleViewChange(index: number) {
    this.activeFilter = index;
    void this.getProjects();
  }

  async toggleFavorite(id?: string) {
    if (!id) return;
    try {
      const res = await this.api.toggleFavorite(id);
      if (res.done)
        await this.getProjects();
    } catch (e) {
      log_error(e);
    }
  }

  trackBy(index: number, item: IProjectViewModel) {
    return item.id;
  }

  selectProject(id: string) {
    if (id) {
      void this.router.navigate([`/worklenz/projects/${id}`]);
    }
  }

}
