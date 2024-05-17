import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzGridModule} from "ng-zorro-antd/grid";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {IProjectCategory} from "@interfaces/project-category";
import {log_error} from "@shared/utils";
import {ProjectCategoriesApiService} from "@api/project-categories-api.service";
import {NzInputModule} from "ng-zorro-antd/input";
import {ProjectFormService} from "@services/project-form-service.service";

@Component({
  selector: 'worklenz-project-categories-autocomplete',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    NzFormModule,
    NzGridModule,
    NzIconModule,
    NzSelectModule,
    NzWaveModule,
    SafeStringPipe,
    ReactiveFormsModule,
    FormsModule,
    NzInputModule
  ],
  templateUrl: './project-categories-autocomplete.component.html',
  styleUrls: ['./project-categories-autocomplete.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectCategoriesAutocompleteComponent implements OnInit {
  @ViewChild("nameInput", {static: false}) nameInput!: ElementRef;

  @Input() categoryId: string | null = null;
  @Output() categoryIdChange = new EventEmitter<string | null>();

  @Input() disabled = false;

  loading = false;
  creating = false;
  showCategoryInput = false;
  categories: IProjectCategory[] = [];
  newCategoryName: string | null = null;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ProjectCategoriesApiService,
    private readonly ngZone: NgZone,
  ) {
  }

  ngOnInit() {
    void this.get();
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.get();
      if (res.done) {
        this.categories = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  newCategory() {
    if (this.showCategoryInput) return;
    this.newCategoryName = null;
    this.showCategoryInput = true;
    this.focusInput();
    this.cdr.markForCheck();
  }

  onCategoryChange(categoryId: string) {
    this.categoryId = categoryId;
    this.categoryIdChange.emit(this.categoryId);
  }

  resetInputMode() {
    this.showCategoryInput = false;
    this.newCategoryName = null;
  }

  async create() {
    if (!this.newCategoryName?.trim() || this.creating) return;
    try {
      this.creating = true;
      const body = {
        name: this.newCategoryName
      };
      const res = await this.api.create(body);
      if (res.done) {
        await this.get();
        this.handleCreate(res.body);
      }
      this.creating = false;
    } catch (e) {
      this.creating = false;
    }

    this.cdr.markForCheck();
  }

  private handleCreate(category: IProjectCategory) {
    this.onCategoryChange(category.id as string);
    this.resetInputMode();
  }

  private focusInput() {
    this.ngZone.runOutsideAngular(() => {
      // wait for html to display
      setTimeout(() => {
        this.nameInput.nativeElement?.focus();
      });
    });
  }

}
