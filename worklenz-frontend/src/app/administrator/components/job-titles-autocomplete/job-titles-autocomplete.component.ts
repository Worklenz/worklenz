import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';

import {JobTitlesApiService} from '@api/job-titles-api.service';
import {IJobTitle} from '@interfaces/job-title';
import {log_error} from "@shared/utils";
import {NzInputModule} from "ng-zorro-antd/input";
import {NgForOf, NgIf} from "@angular/common";
import {NzAutocompleteModule} from "ng-zorro-antd/auto-complete";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzIconModule} from "ng-zorro-antd/icon";

@Component({
  selector: 'worklenz-job-titles-autocomplete',
  templateUrl: './job-titles-autocomplete.component.html',
  styleUrls: ['./job-titles-autocomplete.component.scss'],
  imports: [
    NzInputModule,
    NgIf,
    ReactiveFormsModule,
    NgForOf,
    NzAutocompleteModule,
    NzFormModule,
    NzIconModule
  ],
  standalone: true
})
export class JobTitlesAutocompleteComponent implements OnInit {
  @Output() titleChange: EventEmitter<string> = new EventEmitter<string>();
  @Input() title: string | null = null;
  @Input() placeholder = "Job Title";

  form!: FormGroup;

  @Input() loading = false;
  @Output() loadingChange: EventEmitter<boolean> = new EventEmitter<boolean>();
  searching = false;
  isNew = false;

  newTitle: string | null = null;

  jobTitles: IJobTitle[] = [];

  total = 0;

  constructor(
    private api: JobTitlesApiService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      name: [null]
    });
  }

  async ngOnInit() {
    this.form.controls['name'].setValue(this.title || null);
    this.form.get('name')?.valueChanges.subscribe((value) => {
      if (value) {
        this.newTitle = value;
        this.isNew = !this.jobTitles.some((i) => i.name === value);
        return;
      }

      this.isNew = false;
    });
    await this.get();
  }

  async get() {
    try {
      this.setLoading(true);
      const res = await this.api.get(1, 5, null, null, this.form.value.name || null);
      if (res.done) {
        this.jobTitles = res.body.data || [];
        this.total = this.jobTitles.length;
      }
      this.setLoading(false);
    } catch (e) {
      this.setLoading(false);
      log_error(e);
    }
  }

  async search() {
    this.emitChange();
    this.searching = true;
    await this.get();
    this.searching = false;
  }

  private setLoading(loading: boolean) {
    this.loading = loading;
    this.loadingChange.emit(this.loading);
  }

  private emitChange() {
    if (this.form.valid)
      this.titleChange.emit(this.form.value.name.trim());
  }
}
