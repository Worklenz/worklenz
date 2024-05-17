import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {HomePageApiService} from "@api/home-page-api.service";
import {HomepageService} from "../../homepage-service.service";
import {IMyTask} from "@interfaces/my-tasks";
import {log_error} from "@shared/utils";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {IProjectViewModel} from "@interfaces/api-models/project-view-model";

@Component({
  selector: 'worklenz-personal-tasks',
  templateUrl: './personal-tasks.component.html',
  styleUrls: ['./personal-tasks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PersonalTasksComponent implements OnInit {

  loading = true;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly homePageApi: HomePageApiService,
    public readonly homePageService: HomepageService
  ) {

    this.homePageService.newPersonalTaskReceived
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.handlePersonalTaskReceived(value);
      })

    this.homePageService.removeTaskFromList
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.removeTaskFromList(value);
      })
  }

  ngOnInit() {
    this.homePageService.personal_tasks = [];
    this.getPersonalTasks(true);
  }

  async getPersonalTasks(isLoading: boolean) {
    try {
      this.loading = isLoading;
      this.homePageService.loadingPersonalTasks = true;
      const res = await this.homePageApi.getPersonalTasks();
      if (res) {
        this.homePageService.personal_tasks = res.body;
      }
      this.loading = false;
      this.homePageService.loadingPersonalTasks = false;
    } catch (e) {
      this.loading = false;
      this.homePageService.loadingPersonalTasks = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  handlePersonalTaskReceived(receivedTask: IMyTask) {
    if (!receivedTask) return;
    this.homePageService.personal_tasks.unshift(receivedTask);
    this.cdr.markForCheck();
  }

  removeTaskFromList(id: string) {
    if (!id) return;
    // const taskToRemove = this.homePageService.personal_tasks.findIndex(item => item.id === id);
    // this.homePageService.personal_tasks.splice(taskToRemove, 1);
    this.getPersonalTasks(false);
    this.cdr.markForCheck();
  }

  trackBy(index: number, item: IProjectViewModel) {
    return item.id;
  }
}
