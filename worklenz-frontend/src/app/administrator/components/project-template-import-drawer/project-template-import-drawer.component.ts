import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {log_error} from "@shared/utils";
import {
  WorklenzTemplateListComponent
} from "@admin/components/project-template-import-drawer/worklenz-template-list/worklenz-template-list.component";
import {
  CustomTemplateListComponent
} from "@admin/components/project-template-import-drawer/custom-template-list/custom-template-list.component";
import {ProjectTemplateApiService} from "@api/project-template-api.service";
import {Router} from "@angular/router";

@Component({
  selector: 'worklenz-project-template-import-drawer',
  standalone: true,
  imports: [CommonModule, NzDrawerModule, NzButtonModule, NzWaveModule, NzTabsModule, WorklenzTemplateListComponent, CustomTemplateListComponent],
  templateUrl: './project-template-import-drawer.component.html',
  styleUrls: ['./project-template-import-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class ProjectTemplateImportDrawerComponent {
  @Input({required: true}) showBothTabs = true;
  @Output() importProject: EventEmitter<any> = new EventEmitter<any>();

  selectedWorklenzTemplateId: string | null = null;
  selectedCustomTemplateId: string | null = null;

  selectedTabIndex = 0;

  show = false;
  loading = false;
  creating = false;

  drawerVisible = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ProjectTemplateApiService,
    private readonly router: Router
  ) {
  }

  public open() {
    this.reset();
    this.show = true;
    this.cdr.markForCheck();
  }

  close() {
    this.show = false;
    this.cdr.markForCheck();
  }

  async create() {
    if (this.showBothTabs) {
      if (this.selectedTabIndex === 0) {
        await this.createFromWorklenzLib();
        return;
      }
      if (this.selectedTabIndex === 1) {
        await this.createFromCustomLib();
        return;
      }
    } else {
      this.importProject.emit({template_id: this.selectedWorklenzTemplateId});
    }
  }

  async createFromWorklenzLib() {
    if (!this.selectedWorklenzTemplateId) return;
    try {
      this.creating = true;
      const res = await this.api.createFromTemplate({template_id: this.selectedWorklenzTemplateId});
      if (res.done) {
        this.creating = false;
        this.close();
        this.importProject.emit({project_id: res.body.project_id});
        await this.router.navigate([`/worklenz/projects/${res.body.project_id}`]);
        this.cdr.markForCheck();
      }
      this.creating = false;
    } catch (e) {
      log_error(e);
      this.creating = false;
      this.cdr.markForCheck();
    }
  }

  async createFromCustomLib() {
    if (!this.selectedCustomTemplateId) return;
    try {
      this.creating = true;
      const res = await this.api.createFromCustomTemplate({template_id: this.selectedCustomTemplateId});
      if (res.done) {
        this.creating = false;
        this.close();
        this.importProject.emit({project_id: res.body.project_id});
        await this.router.navigate([`/worklenz/projects/${res.body.project_id}`]);
        this.cdr.markForCheck();
      }
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.creating = false;
      this.cdr.markForCheck();
    }
  }

  changeSelectedWorklenzTemp(templateId: string) {
    this.selectedWorklenzTemplateId = templateId;
    this.selectedCustomTemplateId = null;
    this.cdr.markForCheck();
  }

  changeSelectedCustomTemp(templateId: string) {
    this.selectedCustomTemplateId = templateId;
    this.selectedWorklenzTemplateId = null;
    this.cdr.markForCheck();
  }

  reset() {
    this.selectedWorklenzTemplateId = null;
    this.selectedCustomTemplateId = null;
    this.loading = false;
    this.creating = false;
    this.selectedTabIndex = 0;
    this.cdr.markForCheck();
  }

  onDrawerVisibilityChange(event: boolean) {
    this.drawerVisible = event;
  }
}
