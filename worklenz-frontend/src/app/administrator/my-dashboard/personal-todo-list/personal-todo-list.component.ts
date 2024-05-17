import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ProjectsDefaultColorCodes} from "@shared/constants";
import {ITodoListItem} from "@interfaces/todo-list-item";
import {TodoListApiService} from "@api/todo-list-api.service";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {AppService} from "@services/app.service";
import {CdkDragDrop} from "@angular/cdk/drag-drop";
import {log_error} from "@shared/utils";

@Component({
  selector: 'worklenz-personal-todo-list',
  templateUrl: './personal-todo-list.component.html',
  styleUrls: ['./personal-todo-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PersonalTodoListComponent implements OnInit {
  form!: FormGroup;
  searchForm!: FormGroup;

  colorCodes = ProjectsDefaultColorCodes;

  tasks: ITodoListItem[] = [];

  loading = false;
  creating = false;
  deleteMap: { [x: string]: boolean } = {};
  deletingMap: { [x: string]: boolean } = {};
  showEditDrawer = false;
  selectedItem: ITodoListItem | null = null;
  updating = false;
  private readonly showCompletedTasksKey = "my-dashboard-show-completed-tasks";

  constructor(
    private readonly api: TodoListApiService,
    private readonly app: AppService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      name: [null, [Validators.required, Validators.pattern(/^(\s+\S+\s*)*(?!\s).*$/)]],
      color_code: [ProjectsDefaultColorCodes[ProjectsDefaultColorCodes.length - 1], Validators.required],
      description: []
    });
    this.searchForm = this.fb.group({
      search: []
    });
    this.searchForm.valueChanges.subscribe(() => {
      void this.searchTasks();
    });
  }

  get name() {
    return this.form.value.name || '';
  }

  get showCompleted() {
    return !!localStorage.getItem(this.showCompletedTasksKey);
  }

  set showCompleted(value: boolean) {
    if (value) {
      localStorage.setItem(this.showCompletedTasksKey, "1");
    } else {
      localStorage.removeItem(this.showCompletedTasksKey);
    }
  }

  async ngOnInit() {
    await this.get();
  }

  async searchTasks() {
    await this.get();
  }

  async get(ignoreLoading = false) {
    try {
      if (!ignoreLoading)
        this.loading = true;
      const res = await this.api.get(this.searchForm.value.search, this.showCompleted || null);
      if (res.done) {
        this.tasks = res.body;
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  async create() {
    if (this.form.invalid) {
      this.app.displayErrorsOf(this.form);
      return;
    }

    try {
      this.creating = true;
      const res = await this.api.create(this.form.value);
      if (res.done) {
        await this.get(true);
        const color = this.form.value.color_code;
        this.form.reset({color_code: color});
      }
      this.creating = false;
    } catch (e) {
      log_error(e);
      this.creating = false;
    }
    this.cdr.markForCheck();
  }

  async delete(id?: string) {
    if (!id) return;
    try {
      this.deleteMap[id] = true;
      const res = await this.api.delete(id);
      if (res.done) {
        await this.get(true);
      } else {
        this.deleteMap[id] = false;
      }
    } catch (e) {
      log_error(e);
      this.deleteMap[id] = false;
    }
    this.cdr.markForCheck();
  }

  async toggleDone(id?: string, done?: boolean) {
    if (!id) return;
    try {
      const res = await this.api.updateStatus(id, {done: !!done});
      if (res.done) {
        if (done && !this.showCompleted) {
          setTimeout(() => {
            this.deletingMap[id] = true;
            setTimeout(() => {
              delete this.deletingMap[id];
              this.get(true);
            }, 200);
          }, 250);
        } else {
          await this.get(true);
        }
      }
    } catch (e) {
      log_error(e);
    }
  }

  identify(_index: number, item: ITodoListItem) {
    return item.id;
  }

  closeModal() {
    this.showEditDrawer = false;
  }

  editItem(item: ITodoListItem) {
    this.selectedItem = {...item};
    this.showEditDrawer = true;
  }

  async update() {
    if (!this.selectedItem || !this.selectedItem.id) return;
    try {
      this.updating = true;
      const res = await this.api.update(this.selectedItem.id, this.selectedItem);
      if (res.done) {
        await this.get(true);
        this.closeModal();
        this.selectedItem = null;
      }
      this.updating = false;
    } catch (e) {
      log_error(e);
      this.updating = false;
    }

    this.cdr.markForCheck();
  }

  async onTaskDrop<T>($event: CdkDragDrop<T, any>) {
    const {currentIndex, previousIndex} = $event;
    await this.updateIndex(currentIndex, previousIndex);
  }

  private async updateIndex(currentIndex: number, previousIndex: number) {
    try {
      const res = await this.api.updateIndex(previousIndex, currentIndex);
      if (res.done) {
        this.get(true);
      }
    } catch (e) {
      log_error(e);
    }
  }
}
