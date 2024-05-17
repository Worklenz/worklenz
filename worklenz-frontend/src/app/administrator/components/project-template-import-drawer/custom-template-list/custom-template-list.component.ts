import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {log_error} from "@shared/utils";
import {ProjectTemplateApiService} from "@api/project-template-api.service";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzListModule} from "ng-zorro-antd/list";
import {FormsModule} from "@angular/forms";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzIconModule} from "ng-zorro-antd/icon";
import {ICustomTemplate} from "@interfaces/api-models/project-template";
import {NzEmptyModule} from "ng-zorro-antd/empty";

@Component({
  selector: 'worklenz-custom-template-list',
  standalone: true,
  imports: [CommonModule, NzSkeletonModule, NzListModule, FormsModule, NzCheckboxModule, NzInputModule, NzMenuModule, SearchByNamePipe, NzBadgeModule, NzSpaceModule, NzIconModule, NzEmptyModule],
  templateUrl: './custom-template-list.component.html',
  styleUrls: ['./custom-template-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomTemplateListComponent implements OnInit {
  @Output() selectTemplate: EventEmitter<string> = new EventEmitter<string>();

  teamSearchText: string | null = null;

  loading = false;

  templateList: ICustomTemplate[] = [];

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ProjectTemplateApiService
  ) {
  }

  ngOnInit() {
    void this.get();
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.getWorklenzCustomTemplates();
      if(res.done) {
        this.templateList = res.body;
        this.loading = false;
      }
      this.loading = false;
    } catch (e) {
      log_error(e)
    }
    this.cdr.markForCheck();
  }

  changeSelectedTemplate(templateId: string | undefined, index: number) {
    for (let i = 0; i < this.templateList.length; i++) {
      this.templateList[i].selected = false;
    }

    this.templateList[index].selected = true;
    this.selectTemplate.emit(templateId);
    this.cdr.markForCheck();
  }

  detectChanges() {
    this.cdr.markForCheck();
  }

}
