/* eslint-disable @angular-eslint/no-input-rename */
import {Component, Input} from '@angular/core';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';

@Component({
  selector: 'worklenz-kanban-task-card',
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.scss']
})
export class TaskCardComponent {
  @Input({required: true}) task!: IProjectTask;

  @Input({required: true}) projectId!: string | null;

}
