import {ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener} from '@angular/core';
import {AvatarNamesMap, DEFAULT_PAGE_SIZE} from "@shared/constants";
import {
  IMyDashboardAllTasksViewModel,
  IMyDashboardProjectTask
} from "@interfaces/api-models/my-dashboard-all-tasks-view-model";
import {ProjectsApiService} from "@api/projects-api.service";
import {IPaginationComponent} from "@interfaces/pagination-component";
import {FormBuilder, FormGroup} from "@angular/forms";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {EventTaskCreatedOrUpdate} from "@shared/events";
import {Router} from "@angular/router";
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";

@Component({
  selector: 'worklenz-projects-tasks',
  templateUrl: './projects-tasks.component.html',
  styleUrls: ['./projects-tasks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsTasksComponent implements IPaginationComponent {
  searchForm!: FormGroup;
  tasks: IMyDashboardProjectTask[] = [];

  model: IMyDashboardAllTasksViewModel = {};

  loading = false;

  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;
  // Changing this order should also reflect to projects-controller:getAllTasks
  options = ['Today', 'Upcoming', 'Overdue'];
  private readonly activeFilterKey = "my-dashboard-active-filter";

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: ProjectsApiService,
    private readonly router: Router,
    private readonly utilsService: UtilsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.searchForm = this.fb.group({
      search: []
    });

    this.searchForm.valueChanges.subscribe(async () => {
      await this.searchTasks();
    });
  }

  get title() {
    const index = this.activeFilter;
    if (index === 0) return `My Tasks (${this.total})`;
    if (index === 1) return `Upcoming (${this.total})`;
    if (index === 2) return `Overdue (${this.total})`;
    return "Tasks";
  }

  get activeFilter() {
    return +(localStorage.getItem(this.activeFilterKey) || 0);
  }

  set activeFilter(value: number) {
    localStorage.setItem(this.activeFilterKey, value.toString());
  }

  @HostListener(`document:${EventTaskCreatedOrUpdate}`)
  async get() {
    try {
      this.loading = true;
      const res = await this.api.getAllTasks(
        this.pageIndex, this.pageSize, this.sortField, this.sortOrder, this.searchForm.value.search, this.activeFilter);
      if (res.done) {
        this.model = res.body;
        this.total = this.model.total || 0;

        this.utilsService.handleLastIndex(this.total, this.model.data?.length || 0, this.pageIndex,
          index => {
            this.pageIndex = index;
            this.get();
          });
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  async searchTasks() {
    await this.get();
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    const currentSort = sort.find(item => item.value !== null);

    this.sortField = (currentSort && currentSort.key) || null;
    this.sortOrder = (currentSort && currentSort.value) || null;

    await this.get();
  }

  goToProject(id?: string) {
    if (!id) return;
    void this.router.navigate([`/worklenz/projects/${id}`]);
  }
}
