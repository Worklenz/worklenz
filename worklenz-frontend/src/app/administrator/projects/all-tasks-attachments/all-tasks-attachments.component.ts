import {ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnInit} from '@angular/core';
import {AttachmentsApiService} from "@api/attachments-api.service";
import {
  IProjectAttachmentsViewModel,
  ITaskAttachmentViewModel
} from "@interfaces/api-models/task-attachment-view-model";
import {ActivatedRoute} from "@angular/router";
import {getFileIcon, log_error} from "@shared/utils";
import {HttpClient} from "@angular/common/http";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {DEFAULT_PAGE_SIZE} from "@shared/constants";

@Component({
  selector: 'worklenz-all-tasks-attachments',
  templateUrl: './all-tasks-attachments.component.html',
  styleUrls: ['./all-tasks-attachments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllTasksAttachmentsComponent implements OnInit {
  projectId: string | null = null;
  selectedTaskId: string | null = null;

  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];

  attachments: IProjectAttachmentsViewModel = {};

  loading = true;
  showTaskDrawer = false;
  downloading = false;

  options = [
    {label: '', value: 'List', icon: 'bars'},
    {label: '', value: 'Kanban', icon: 'appstore'}
  ];

  constructor(
    private readonly api: AttachmentsApiService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly http: HttpClient,
    private readonly ngZone: NgZone
  ) {
    this.projectId = this.route.snapshot.paramMap.get("id");
  }

  ngOnInit(): void {
    void this.get();
  }

  async get() {
    if (!this.projectId) return;
    try {
      this.loading = true;
      const res = await this.api.getProjectAttachment(this.projectId, this.pageIndex, this.pageSize);
      if (res.done) {
        this.attachments = res.body;
        this.total = this.attachments.total || 0;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
    await this.get();
  }

  async download(id?: string, name?: string) {
    if (!id || !name) return;
    try {
      this.downloading = true;
      const res = await this.api.download(id, name);
      if (res && res.done) {
        this.ngZone.runOutsideAngular(() => {
          const link = document.createElement('a');
          link.href = res.body;
          link.download = name;
          link.click();
          link.remove();
        });
      }
    } catch (e) {
      log_error(e);
    }
    this.downloading = false;
  }

  getFileIcon(type?: string) {
    return getFileIcon(type);
  }

  async delete(id?: string) {
    if (!id) return;
    // Continue to delete from the server for previous tasks
    try {
      const res = await this.api.deleteTaskAttachment(id);
      if (res.done) {
        this.get();
      }
    } catch (e) {
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  open(url?: string) {
    if (!url) return;
    this.ngZone.runOutsideAngular(() => {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.style.display = "none";
      a.click();
    });
  }

  onCreateOrUpdate() {
    this.showTaskDrawer = false;
    this.selectedTaskId = null;
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.selectedTaskId = null;
    }
  }

}
