import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {log_error} from "@shared/utils";
import {ProjectTemplateApiService} from "@api/project-template-api.service";
import {NzMenuModule} from 'ng-zorro-antd/menu';
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzListModule} from "ng-zorro-antd/list";
import {IProjectTemplate, IWorklenzTemplate} from "@interfaces/api-models/project-template";

@Component({
  selector: 'worklenz-template-list',
  standalone: true,
  imports: [CommonModule, NzMenuModule, NzSkeletonModule, NzTypographyModule, NzTagModule, NzSpaceModule, NzListModule],
  templateUrl: './worklenz-template-list.component.html',
  styleUrls: ['./worklenz-template-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorklenzTemplateListComponent implements OnInit {
  @Output() selectTemplate: EventEmitter<string> = new EventEmitter<string>();

  loadingList = false;
  loadingDetails = false;

  selectedTemplateIndex = 0;

  templateList: IWorklenzTemplate[] = [];

  templateDetails: IProjectTemplate = {}

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ProjectTemplateApiService,
  ) {
  }

  ngOnInit() {
    void this.get();
  }

  async get() {
    try {
      this.loadingList = true;
      const res = await this.api.getWorklenzTemplates();
      if (res.done) {
        this.templateList = res.body;
        this.loadingList = false;
        await this.emitTemplateSelect();
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e)
      this.cdr.markForCheck();
    }
  }

  onSelectTemplate(templateId: string, selectedIndex: number) {
    if (!templateId) return;
    this.selectedTemplateIndex = selectedIndex;
    setTimeout(() => {
      void this.emitTemplateSelect();
    }, 500)
    this.cdr.markForCheck();
  }

  async emitTemplateSelect() {
    const selectedTemplateId = this.templateList[this.selectedTemplateIndex].id;
    this.selectTemplate.emit(selectedTemplateId);

    if (selectedTemplateId) {
      this.loadingDetails = true;
      const res = await this.api.getWorklenzTemplateById(selectedTemplateId);
      if (res.done) {
        this.templateDetails = res.body;
        this.loadingDetails = false;
      }
      this.loadingDetails = false;
    }
    this.cdr.markForCheck();
  }

}
