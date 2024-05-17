import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";

@Component({
  selector: 'worklenz-project-updates',
  templateUrl: './project-updates.component.html',
  styleUrls: ['./project-updates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectUpdatesComponent {
  projectId: string | null = null;
  selectedTaskId: string | null = null;

  showTaskDrawer = false;

  constructor(
    private route: ActivatedRoute
  ) {
    this.projectId = this.route.snapshot.paramMap.get("id");
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.selectedTaskId = null;
    }
  }
}
