import {Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";

import {ClientsApiService} from "@api/clients-api.service";

import {IClientViewModel} from "@interfaces/api-models/client-view-model";
import {IClient} from "@interfaces/client";

import {AppService} from "@services/app.service";
import {IPaginationComponent} from "@interfaces/pagination-component";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {IClientsViewModel} from "@interfaces/api-models/clients-view-model";
import {MenuService} from "@services/menu.service";
import {DEFAULT_PAGE_SIZE} from "@shared/constants";
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";

@Component({
  selector: 'worklenz-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})
export class ClientsComponent implements IPaginationComponent {
  form!: FormGroup;
  searchForm!: FormGroup;

  showClientsModal = false;

  client: IClientViewModel = {};
  model: IClientsViewModel = {};

  loading = false;
  loadingSingleClient = false;
  action = 'Create';

  // Table sorting & pagination
  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;

  constructor(
    private app: AppService,
    private api: ClientsApiService,
    private fb: FormBuilder,
    public menu: MenuService,
    private utilsService: UtilsService
  ) {
    this.app.setTitle("Manage Clients");

    this.form = this.fb.group({
      name: [null, [Validators.required]]
    });
    this.searchForm = this.fb.group({search: []});
    this.searchForm.valueChanges.subscribe(() => this.searchProjects());
  }

  async addClient() {
    try {
      const body: IClient = {
        name: this.form.controls["name"].value
      };

      const res = await this.api.create(body);
      if (res.done) {
        this.closeModal();
        await this.getClients();
      }
    } catch (e) {
      log_error(e);
    }
  }

  async getClients() {
    try {
      this.loading = true;
      const res = await this.api.get(this.pageIndex, this.pageSize, this.sortField, this.sortOrder, this.searchForm.value.search);
      if (res.done) {
        this.model = res.body;
        this.total = this.model.total || 0;

        this.utilsService.handleLastIndex(this.total, this.model.data?.length || 0, this.pageIndex,
          index => {
            this.pageIndex = index;
            this.getClients();
          });
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
  }

  async getClient(id: string) {
    try {
      this.loadingSingleClient = true;
      const res = await this.api.getById(id);
      if (res.done) {
        this.client = res.body;
        this.form.controls["name"].setValue(this.client.name);
      }
      this.loadingSingleClient = false;
    } catch (e) {
      log_error(e);
      this.loadingSingleClient = false;
    }
  }

  async updateClient() {
    if (!this.client || !this.client.id) return;
    try {
      this.loadingSingleClient = true;
      const body: IClient = {
        name: this.form.controls["name"].value
      };
      const res = await this.api.update(this.client.id, body);
      this.loadingSingleClient = false;
      if (res.done) {
        this.closeModal();
        await this.getClients();
      }
    } catch (e) {
      this.loadingSingleClient = false;
      log_error(e);
    }
  }

  async deleteClient(id: string | undefined) {
    if (!id) return;
    try {
      const res = await this.api.delete(id);
      if (res.done) {
        await this.getClients();
      }
    } catch (e) {
      log_error(e);
    }
  }

  async editClient(id: string | undefined) {
    if (!id) return;
    await this.getClient(id);
    this.action = 'Update';
    this.showClientsModal = true;
  }

  closeModal() {
    this.showClientsModal = false;
    this.form.reset();
    this.action = 'Create';
  }

  async handleOk() {
    if (this.client && this.client.id) {
      await this.updateClient();
    } else {
      await this.addClient();
    }
  }

  async searchProjects() {
    this.getClients();
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    const currentSort = sort.find(item => item.value !== null);

    this.sortField = (currentSort && currentSort.key) || null;
    this.sortOrder = (currentSort && currentSort.value) || null;

    await this.getClients();
  }

}
