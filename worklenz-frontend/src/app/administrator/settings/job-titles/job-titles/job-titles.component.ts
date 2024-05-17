import {Component} from '@angular/core';
import {NzTableQueryParams} from "ng-zorro-antd/table";

import {IJobTitle} from "@interfaces/job-title";
import {JobTitlesApiService} from "@api/job-titles-api.service";
import {AppService} from "@services/app.service";
import {IPaginationComponent} from "@interfaces/pagination-component";
import {IJobTitlesViewModel} from "@interfaces/api-models/job-titles-view-model";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {MenuService} from "@services/menu.service";
import {DEFAULT_PAGE_SIZE} from "@shared/constants";
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";

@Component({
  selector: 'worklenz-job-titles',
  templateUrl: './job-titles.component.html',
  styleUrls: ['./job-titles.component.scss']
})
export class JobTitlesComponent implements IPaginationComponent {
  form!: FormGroup;
  searchForm!: FormGroup;

  showJobTitlesModal = false;

  model: IJobTitlesViewModel = {};
  jobTitle: IJobTitle = {};

  loading = false;
  loadingSingle = false;
  action = 'Create';

  // Table sorting & pagination
  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;

  constructor(
    private api: JobTitlesApiService,
    private fb: FormBuilder,
    private app: AppService,
    public menu: MenuService,
    private utilsService: UtilsService
  ) {
    this.app.setTitle("Manage Job Titles");

    this.form = this.fb.group({
      name: [null, [Validators.required]]
    });
    this.searchForm = this.fb.group({
      search: ['']
    })
    this.searchForm.valueChanges.subscribe(() => {
      this.searchJobTitles().then(r => r);
    })
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    const currentSort = sort.find(item => item.value !== null);

    this.sortField = (currentSort && currentSort.key) || null;
    this.sortOrder = (currentSort && currentSort.value) || null;

    await this.getJobTitles();
  }

  async addJobTitle() {
    try {
      const body: IJobTitle = {
        name: this.form.controls["name"].value
      };

      const res = await this.api.create(body);
      if (res.done) {
        this.closeModal();
        await this.getJobTitles();
      }
    } catch (e) {
      log_error(e);
    }
  }

  async getJobTitles() {
    try {
      this.loading = true;
      const res = await this.api.get(this.pageIndex, this.pageSize, this.sortField, this.sortOrder, this.searchForm.value.search);
      if (res.done) {
        this.model = res.body;
        this.total = this.model.total || 0;

        this.utilsService.handleLastIndex(this.total, this.model.data?.length || 0, this.pageIndex,
          index => {
            this.pageIndex = index;
            this.getJobTitles();
          });
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
  }

  async getJobTitle(id: string) {
    try {
      this.loadingSingle = true;
      const res = await this.api.getById(id);
      if (res.done) {
        this.jobTitle = res.body;
        this.form.controls["name"].setValue(this.jobTitle.name);
      }
      this.loadingSingle = false;
    } catch (e) {
      log_error(e);
      this.loadingSingle = false;
    }
  }

  async updateJobTitle() {
    if (!this.jobTitle || !this.jobTitle.id) return;
    try {
      this.loadingSingle = true;
      const body: IJobTitle = {
        name: this.form.controls["name"].value
      };
      const res = await this.api.update(this.jobTitle.id, body);
      this.loadingSingle = false;
      if (res.done) {
        this.closeModal();
        await this.getJobTitles();
      }
    } catch (e) {
      this.loadingSingle = false;
      log_error(e);
    }
  }

  async delete(id: string | undefined) {
    if (!id) return;
    try {
      const res = await this.api.delete(id);
      if (res.done) {
        await this.getJobTitles();
      }
    } catch (e) {
      log_error(e);
    }
  }

  async edit(id: string | undefined) {
    if (!id) return;
    await this.getJobTitle(id);
    this.action = 'Update';
    this.showJobTitlesModal = true;
  }

  closeModal() {
    this.showJobTitlesModal = false;
    this.form.reset();
    this.jobTitle = {};
    this.action = 'Create';
  }

  async handleOk() {
    if (this.jobTitle && this.jobTitle.id) {
      await this.updateJobTitle();
    } else {
      await this.addJobTitle();
    }
  }

  async searchJobTitles() {
    this.getJobTitles().then(r => r);
  }

}
