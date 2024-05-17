import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {IProjectCategory} from "@interfaces/project-category";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {FormBuilder, FormGroup} from "@angular/forms";
import {log_error} from "@shared/utils";
import {ProjectCategoriesApiService} from "@api/project-categories-api.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {AuthService} from "@services/auth.service";
import {IRPTProject} from "../../interfaces";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";

@Component({
  selector: 'worklenz-project-category',
  templateUrl: './project-category.component.html',
  styleUrls: ['./project-category.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectCategoryComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput', {static: false}) searchInput!: ElementRef<HTMLInputElement>;
  @Input({required: true}) teamId: string | null = null;
  @Input({required: true}) project: IRPTProject | null = null;

  projCategories: IProjectCategory[] = [];
  private session: ILocalSession | null = null;

  categorySearchText = null;

  showText = false;
  show = false;
  loadingCategories = true;

  form!: FormGroup;

  get hasFilteredCategories() {
    return !!this.filteredCategories.length;
  }

  get filteredCategories() {
    return this.searchPipe.transform(this.projCategories, this.categorySearchText);
  }

  constructor(
    private readonly ngZone: NgZone,
    private readonly fb: FormBuilder,
    private readonly categoriesApi: ProjectCategoriesApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly auth: AuthService,
    private readonly searchPipe: SearchByNamePipe,
  ) {
    this.form = this.fb.group({
      category: [],
    });
    this.session = this.auth.getCurrentSession();
  }

  ngOnInit() {
    this.socket.on(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), this.handleResponse);
    this.socket.on(SocketEvents.CREATE_PROJECT_CATEGORY.toString(), this.handleLabelsCreate);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), this.handleResponse);
    this.socket.removeListener(SocketEvents.CREATE_PROJECT_CATEGORY.toString(), this.handleLabelsCreate);
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  async getProjectCategories() {
    if (!this.teamId) return;
    try {
      this.loadingCategories = true;
      const res = await this.categoriesApi.getByTeamId(this.teamId);
      if (res.done) {
        this.projCategories = res.body;
      }
      this.loadingCategories = false;
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.loadingCategories = false;
      this.cdr.markForCheck();
    }
  }

  create() {
    if (!this.teamId || this.hasFilteredCategories || !this.categorySearchText) return;
    this.socket.emit(SocketEvents.CREATE_PROJECT_CATEGORY.toString(), JSON.stringify({
      project_id: this.project?.id,
      name: this.categorySearchText,
      team_id: this.teamId,
      user_id: this.session?.id
    }));
  }

  update(categoryId?: string) {
    if (!categoryId) return;
    this.socket.emit(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), JSON.stringify({
      project_id: this.project?.id,
      category_id: categoryId,
      is_update: true
    }));
    this.cdr.markForCheck();
  }

  remove() {
    this.socket.emit(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), JSON.stringify({
      project_id: this.project?.id,
      category_id: null,
      is_update: false
    }));
    this.cdr.markForCheck();
  }

  handleLabelsVisibleChange(visible: boolean) {
    if (visible) {
      this.show = true;
      this.getProjectCategories();
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.searchInput?.nativeElement?.focus();
        }, 100);
      });
    } else {
      this.reset();
    }
  }

  private handleResponse = (response: {
    id: string;
    category_id: string | null;
    category_name: string;
    category_color: string
  }) => {
    if (response && this.project && response.id === this.project.id) {
      this.project.category_id = response.category_id;
      this.project.category_name = response.category_name;
      this.project.category_color = response.category_color;
      this.reset();
      this.cdr.markForCheck();
    }
  }

  handleLabelsCreate = (response: {
    id: string;
    category_id: string | null;
    category_name: string;
    category_color: string
  }) => {
    if (this.project && response.id === this.project.id && this.teamId && response && response.category_id) {
      this.projCategories.push({
        id: response.category_id,
        name: response.category_name,
        color_code: response.category_color,
        team_id: this.teamId
      });
      this.update(response.category_id as string);
      this.cdr.markForCheck();
    }
  }


  reset() {
    this.searchInput?.nativeElement?.blur();
    this.categorySearchText = null;
    this.show = false;
    this.projCategories = [];
    this.showText = false;
    this.form.controls["category"].setValue(null);
    this.cdr.markForCheck();
  }

}
