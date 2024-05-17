import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {ProjectsApiService} from "@api/projects-api.service";
import {IProject} from "@interfaces/project";
import {log_error} from "@shared/utils";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzFormModule} from "ng-zorro-antd/form";
import {NgForOf, NgIf} from "@angular/common";
import {NzIconModule} from "ng-zorro-antd/icon";

@Component({
  selector: 'worklenz-projects-autocomplete',
  templateUrl: './projects-autocomplete.component.html',
  styleUrls: ['./projects-autocomplete.component.scss'],
  imports: [
    NzSelectModule,
    NzFormModule,
    NgIf,
    ReactiveFormsModule,
    NgForOf,
    NzIconModule
  ],
  standalone: true
})
export class ProjectsAutocompleteComponent implements OnInit {
  @Output() projectNamesChange: EventEmitter<string[]> = new EventEmitter<string[]>();
  @Input() projectNames: string[] = [];

  @Input() placeholder = 'Select Projects';
  @Input() label = 'Projects';

  @Input() multiple = false;
  @Input() disabled = false;

  form!: FormGroup;

  loading = false;
  searching = false;

  projects: IProject[] = [];

  total = 0;

  searchingName: string | null = null;

  constructor(
    private api: ProjectsApiService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      project_names: []
    });

    this.form.controls["project_names"]?.valueChanges.subscribe(value => {
      this.projectNames = value;
      this.projectNamesChange.emit(this.projectNames);
    });
  }

  async ngOnInit() {
    this.form.controls["project_names"].setValue(this.projectNames || []);
    void this.init();
  }

  async init() {
    this.loading = true;
    await this.get();
    this.loading = false;
  }

  async get() {
    try {
      const res = await this.api.get(1, 5, null, null, this.searchingName);
      if (res.done) {
        this.projects = res.body.data || [];
        this.total = this.projects.length;
      }
    } catch (e) {
      log_error(e);
    }
  }

  async search(value: string) {
    this.searchingName = value;
    this.searching = true;
    await this.get();
    this.searching = false;
  }

  public reset() {
    this.form.reset();
    this.searchingName = null;
    void this.init();
  }
}
