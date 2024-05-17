import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {FromNowPipe} from "@pipes/from-now.pipe";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzCommentModule} from "ng-zorro-antd/comment";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {IProjectUpdateCommentViewModel} from "@interfaces/project";
import {UtilsService} from "@services/utils.service";
import {ProjectUpdatesListComponent} from "@admin/components/project-updates-list/project-updates-list.component";

@Component({
  selector: 'worklenz-project-updates-drawer',
  standalone: true,
  imports: [
    CommonModule,
    NzDrawerModule,
    NzSpinModule,
    FirstCharUpperPipe,
    FromNowPipe,
    NzAvatarModule,
    NzCommentModule,
    NzPopconfirmModule,
    NzSkeletonModule,
    ProjectUpdatesListComponent
  ],
  templateUrl: './project-updates-drawer.component.html',
  styleUrls: ['./project-updates-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectUpdatesDrawerComponent {

  @ViewChild(ProjectUpdatesListComponent) list!: ProjectUpdatesListComponent;

  show = false;
  projectId: string | null = null;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    public readonly utils: UtilsService,
  ) {
  }

  public async open(projectId: string) {
    this.show = true;
    await this.list.loadDataOnDrawer(projectId);
    this.cdr.markForCheck();
  }

  handleClose() {
    this.reset();
    this.show = false;
  }

  onVisibleChange(visible: boolean) {
    if (visible) {
      this.cdr.markForCheck();
    }
  }

  reset() {
    this.projectId = null;
  }

}
