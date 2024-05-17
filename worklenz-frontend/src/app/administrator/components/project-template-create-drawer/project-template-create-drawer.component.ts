import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  ViewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzFormModule} from "ng-zorro-antd/form";
import {FormsModule} from "@angular/forms";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzInputModule} from 'ng-zorro-antd/input';
import {NzButtonModule} from 'ng-zorro-antd/button';
import {log_error} from "@shared/utils";
import {ICustomProjectTemplateCreateRequest} from "@interfaces/project-template";
import {ProjectTemplateApiService} from "@api/project-template-api.service";

@Component({
  selector: 'worklenz-project-template-create-drawer',
  standalone: true,
  imports: [CommonModule, NzDrawerModule, NzFormModule, FormsModule, NzTypographyModule, NzCheckboxModule, NzInputModule, NzButtonModule],
  templateUrl: './project-template-create-drawer.component.html',
  styleUrls: ['./project-template-create-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTemplateCreateDrawerComponent {
  @ViewChild('templateNameInput') templateNameInput!: ElementRef;
  @Input({required: true}) projectId: string | null = null;

  templateName: string | null = null;

  show = false;
  checked = true;
  showErrorText = false;
  disableBtnActive = true;

  pStatusCheck = true;
  pPhasesCheck = true;
  pLabelsCheck = true;

  tStatusCheck = true;
  tPhaseCheck = true;
  tEstimationCheck = true;
  tLabelsCheck = true;
  tDescriptionCheck = true;
  tSubTasksCheck = true;

  creating = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ProjectTemplateApiService,
    private readonly ngZone: NgZone,
  ) {
  }

  public async open() {
    this.show = true;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.templateNameInput.nativeElement.focus();
      }, 100)
    })
    this.cdr.markForCheck();
  }

  close() {
    this.show = false;
    this.cdr.markForCheck();
  }

  nameChange(text: string) {
    if (text.trim() === "") {
      this.showErrorText = true;
      return;
    }
    this.disableBtnActive = false;
    this.showErrorText = false;
    this.cdr.markForCheck();
  }

  projectCheckChange(key: string, value: boolean) {
    switch (key) {
      case 'pStatuses':
        if (!value)
          this.tStatusCheck = false;
        break;
      case 'pPhases':
        if (!value)
          this.tPhaseCheck = false;
        break;
      case 'pLabels':
        if (!value)
          this.tLabelsCheck = false;
        break;
    }
    this.cdr.markForCheck();
  }

  async saveTemplate() {
    if (!this.templateName || this.templateName.trim() === "" || !this.projectId) {
      this.showErrorText = true;
      return;
    }

    try {
      this.creating = true;
      const body: ICustomProjectTemplateCreateRequest = {
        project_id: this.projectId,
        templateName: this.templateName,
        projectIncludes: {
          statuses: this.pStatusCheck,
          phases: this.pPhasesCheck,
          labels: this.pLabelsCheck
        },
        taskIncludes: {
          status: this.tStatusCheck,
          phase: this.tPhaseCheck,
          labels: this.tLabelsCheck,
          estimation: this.tEstimationCheck,
          description: this.tDescriptionCheck,
          subtasks: this.tSubTasksCheck
        }
      }
      const res = await this.api.createCustomTemplate(body);
      if (res.done) {
        this.creating = false;
        this.show = false;
      }
      this.creating = false;
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.cdr.markForCheck();
    }

  }

}
