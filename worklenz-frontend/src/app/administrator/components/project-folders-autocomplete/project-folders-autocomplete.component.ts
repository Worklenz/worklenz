import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {CommonModule, NgForOf, NgIf} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzAutocompleteModule} from "ng-zorro-antd/auto-complete";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzInputModule} from "ng-zorro-antd/input";
import {log_error} from "@shared/utils";
import {ProjectFoldersApiService} from "@api/project-folders-api.service";
import {IProjectFolder} from "@interfaces/project-folder";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";

@Component({
  selector: 'worklenz-project-folders-autocomplete',
  templateUrl: './project-folders-autocomplete.component.html',
  styleUrls: ['./project-folders-autocomplete.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzAutocompleteModule,
    NzIconModule,
    NgIf,
    NgForOf,
    NzInputModule,
    SearchByNamePipe
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectFoldersAutocompleteComponent implements OnInit {
  form!: FormGroup;
  isNew = false;
  searchValue: string | null = null;
  folders: IProjectFolder[] = [];

  constructor(
    private readonly api: ProjectFoldersApiService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      folder: []
    });
  }

  async ngOnInit() {
    const control = this.form.controls["folder"];
    control.valueChanges.subscribe((value) => {
      this.searchValue = value;
      if (value) {
        this.isNew = !this.folders.some((i) => i.name === value);
        return;
      }

      this.isNew = false;
    });
    await this.get();
  }

  addFolder() {
    void this.create();
  }

  private async get() {
    try {
      const res = await this.api.get();
      if (res.done) {
        this.folders = res.body || [];
      }
    } catch (e) {
      log_error(e);
    }
    this.cdr.markForCheck();
  }

  private async create() {
    if (!this.searchValue) return;
    try {
      const body = {
        name: this.searchValue
      };
      const res = await this.api.create(body);
      if (res.done) {
        void this.get();
      }
    } catch (e) {
      log_error(e);
    }
  }
}
