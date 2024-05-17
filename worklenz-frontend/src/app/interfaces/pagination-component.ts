import {NzTableQueryParams} from "ng-zorro-antd/table";

export interface IPaginationComponent {
  total: number;
  pageSize: number;
  pageIndex: number;
  paginationSizes: number[];
  loading: boolean;
  sortField: string | null;
  sortOrder: string | null;

  onQueryParamsChange(params: NzTableQueryParams): void;
}
