import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ProjectsDefaultColorCodes} from "@shared/constants";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {MenuService} from "@services/menu.service";
import {log_error} from "@shared/utils";
import {AppService} from "@services/app.service";
import {ProjectCategoriesApiService} from "@api/project-categories-api.service";
import {IProjectCategoryViewModel} from "@interfaces/project-category";

@Component({
  selector: 'worklenz-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {
  readonly colorCodes = ProjectsDefaultColorCodes;

  categories: IProjectCategoryViewModel[] = [];
  filteredCategories: IProjectCategoryViewModel[] = [];

  loading = false;
  labelsSearch: string | null = null;

  constructor(
    private readonly app: AppService,
    private readonly api: ProjectCategoriesApiService,
    private readonly searchPipe: SearchByNamePipe,
    private readonly cdr: ChangeDetectorRef,
    public readonly menu: MenuService
  ) {
    this.app.setTitle("Manage Categories");
  }

  ngOnInit(): void {
    void this.get();
  }

  trackByFn(index: number, category: IProjectCategoryViewModel) {
    return category.id;
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.get();
      if (res.done) {
        this.categories = res.body;
        this.filteredCategories = this.categories;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.detectChanges();
  }

  async deleteCategory(category: IProjectCategoryViewModel) {
    if (!category?.id) return;
    try {
      this.loading = true;
      const res = await this.api.deleteById(category.id);
      if (res.done) {
        void this.get();
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.detectChanges();
  }

  async updateColorCode(id?: string, color?: string) {
    if (!id || !color) return;
    try {
      const res = await this.api.updateColor(id, color);
      if (res.done) {
        const label = this.categories.find(l => l.id === id);
        if (label)
          label.color_code = color;
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
    }
  }

  searchCategories(val: string) {
    this.filteredCategories = this.searchPipe.transform(this.categories, val || null) as IProjectCategoryViewModel[];
    this.cdr.markForCheck();
  }
}
