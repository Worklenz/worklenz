import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild
} from '@angular/core';
import {log_error} from "@shared/utils";
import {AuthService} from "@services/auth.service";
import {HomePageApiService} from "@api/home-page-api.service";
import {HomepageService} from "../../../../../homepage-service.service";
import {NzSelectComponent} from "ng-zorro-antd/select";
import {IProject} from "@interfaces/project";
import {IHomeTaskCreateRequest} from "@interfaces/api-models/task-create-request";
import {DEFAULT_TASK_NAME} from "@shared/constants";
import {SocketEvents} from "@shared/socket-events";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {Socket} from "ngx-socket-io";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";
import {IMyTask} from "@interfaces/my-tasks";
import {IPersonalTask} from "../../../../../intefaces";

@Component({
  selector: 'worklenz-task-add-container',
  templateUrl: './task-add-container.component.html',
  styleUrls: ['./task-add-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskAddContainerComponent implements OnInit {
  @ViewChild('task_input') private task_input: ElementRef | undefined;
  @ViewChild('due_date_selector') due_date_selector!: NzSelectComponent;
  @ViewChild('project_selector') project_selector!: NzSelectComponent;
  @Input() isPersonal: boolean = false;

  private session: ILocalSession | null = null;

  newTaskName: string | null = null;
  selectedProjectId: string | null = null;

  taskCreateIndex = 1;

  dueDateOpened = false;
  projectSelectOpened = false;
  loadingProjects = false;

  dueDateOptionsList = [
    {label: 'Today', value: 'Today'},
    {label: 'Tomorrow', value: 'Tomorrow'},
    {label: 'Next Week', value: 'Next Week'},
    {label: 'Next Month', value: 'Next Month'},
    {label: 'No Due Date', value: 'No Due Date'}
  ];

  selectedDueDate = this.dueDateOptionsList[4];

  projects: IProject[] = [];

  today = new Date();
  tomorrow = new Date().setDate(new Date().getDate() + 1);
  nextWeek = new Date().setDate(new Date().getDate() + (7 - new Date().getDay() + 1));
  nextMonth = new Date().setMonth(new Date().getMonth() + 1);

  get profile() {
    return this.auth.getCurrentSession();
  }

  constructor(
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly api: HomePageApiService,
    private readonly socket: Socket,
    public readonly service: HomepageService,
  ) {
  }

  ngOnInit() {
    this.session = this.auth.getCurrentSession();
  }

  onKeyDown(event: any) {
    if (!this.newTaskName || this.newTaskName.trim() == "") return;
    if (event.key == "Tab") {
      if (this.isPersonal) {
        this.task_input?.nativeElement.focus();
      } else {
        // in calendar view
        if (this.service.tasksViewConfig?.current_view === 1) {
          if (this.taskCreateIndex == 1) {
            this.taskCreateIndex = 3;
            setTimeout(() => {
              this.task_input?.nativeElement.blur();
              this.projectSelectOpened = true;
              this.handleProjectOpen();
              this.project_selector.focus();
            }, 150)
          }
          return;
        }
        if (this.taskCreateIndex == 1) {
          this.taskCreateIndex = 2;
          setTimeout(() => {
            this.task_input?.nativeElement.blur();
            this.dueDateOpened = true;
            this.due_date_selector.focus();
          }, 150)
        }
      }
    }

    if (event.key == "Enter") {
      if (this.isPersonal) {
        this.createPersonalTask();
      } else {
        // in calendar view
        if (this.service.tasksViewConfig?.current_view === 1) {
          return;
        }
        if (this.selectedProjectId) {
          this.createMainTask(this.selectedProjectId);
        }
      }
    }
  }

  async handleProjectOpen() {
    const session = this.auth.getCurrentSession();
    const team_id = session?.team_id;
    if (!team_id) return;
    try {
      this.loadingProjects = true;
      const res = await this.api.getProjectsByTeam();
      if (res) {
        this.projects = res.body;
      }
      this.loadingProjects = false;
    } catch (e) {
      log_error(e);
      this.loadingProjects = false;
    }
    this.cdr.markForCheck();
  }

  taskInputFocus() {
    document.getElementById('enter_text')?.classList.remove('d-none');
    document.getElementById('tab_text')?.classList.remove('d-none');
  }

  taskInputBlur() {
    document.getElementById('enter_text')?.classList.add('d-none');
    document.getElementById('tab_text')?.classList.add('d-none');
  }

  dueDateFieldValidate(event: any, refEl: any): void {
    refEl.blur();
    this.taskCreateIndex = 3;
    setTimeout(() => {
      this.dueDateOpened = false;
      this.projectSelectOpened = true;
      this.handleProjectOpen();
      this.project_selector.focus();
    }, 150)
  }

  async createMainTask(event: string) {
    try {

      const body: IHomeTaskCreateRequest = {
        name: this.newTaskName || DEFAULT_TASK_NAME,
        project_id: this.selectedProjectId as string,
        reporter_id: this.session?.id,
        team_id: this.session?.team_id
      };

      switch (this.selectedDueDate.value) {
        case 'Today':
          body.end_date = this.today;
          break;
        case 'Tomorrow':
          body.end_date = new Date(this.tomorrow);
          break;
        case 'Next Week':
          body.end_date = new Date(this.nextWeek);
          break;
        case 'Next Month':
          body.end_date = new Date(this.nextMonth);
          break;
      }

      // if in calendar view
      if (this.service.tasksViewConfig?.current_view === 1) {
        if (this.service.tasksViewConfig.selected_date) {
          body.end_date = new Date(this.service.tasksViewConfig.selected_date);
        }
      }

      this.socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
      this.socket.once(SocketEvents.QUICK_TASK.toString(), (task: IMyTask) => {
        const task_assign_body = {
          team_member_id: this.session?.team_member_id,
          project_id: task.project_id,
          task_id: task.id,
          reporter_id: this.session?.id,
          mode: 0,
        };
        this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(task_assign_body));
        this.socket.once(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), (response: ITaskAssigneesUpdateResponse) => {
          this.service.emitNewTaskReceived(task);
          this.cdr.markForCheck();
        });
      });
    } catch (e) {
      log_error(e);
    }
    this.reset();
  }

  async createPersonalTask() {
    if (!this.newTaskName) return;
    try {
      const createPersonalTaskBody: IPersonalTask = {
        name: this.newTaskName,
        color_code: '#000'
      }
      const res = await this.api.createPersonalTask(createPersonalTaskBody);
      if (res) {
        const personalTask: IMyTask = {
          id: res.body.id,
          name: res.body.name,
          is_task: false,
          done: false
        }
        this.service.emitPersonalTaskReceived(personalTask);
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e)
    }
    this.reset();
  }

  reset() {
    this.taskCreateIndex = 1;
    this.newTaskName = null;
    this.selectedDueDate = this.dueDateOptionsList[4];
    this.selectedProjectId = null;
    this.dueDateOpened = false;
    this.projectSelectOpened = false;
    this.task_input?.nativeElement.focus();
  }
}
