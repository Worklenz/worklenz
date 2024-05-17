import {Component} from '@angular/core';
import {IOrganizationUser} from "@interfaces/account-center";
import {AvatarNamesMap, DEFAULT_PAGE_SIZE} from "@shared/constants";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {log_error} from "@shared/utils";
import {AccountCenterApiService} from "@api/account-center-api.service";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";

@Component({
  selector: 'worklenz-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent {
  visible = false;
  visibleNewMember = false;

  users: IOrganizationUser[] = []
  loading = false;

  // Table sorting & pagination
  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;

  form!: FormGroup;
  searchForm!: FormGroup;

  constructor(
    private api: AccountCenterApiService,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      name: [null, [Validators.required]]
    });
    this.searchForm = this.fb.group({search: []});
    this.searchForm.valueChanges.subscribe(() => this.getUsers());
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    const currentSort = sort.find(item => item.value !== null);

    this.sortField = (currentSort && currentSort.key) || null;
    this.sortOrder = (currentSort && currentSort.value) || null;

    await this.getUsers();
  }

  async getUsers() {
    try {
      this.loading = true;
      const res = await this.api.getOrganizationUsers(this.pageIndex, this.pageSize, this.sortField, this.sortOrder, this.searchForm.value.search);
      if (res.done) {
        this.total = res.body.total || 0;
        this.users = res.body.data || [];
        this.loading = false;
      }
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
  }

}
