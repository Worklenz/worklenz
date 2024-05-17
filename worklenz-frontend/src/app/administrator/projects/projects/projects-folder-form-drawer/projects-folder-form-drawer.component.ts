import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  ViewChild
} from '@angular/core';
import {ProjectsDefaultColorCodes} from "@shared/constants";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ProjectFoldersApiService} from "@api/project-folders-api.service";
import {FolderCreateEventCallback, ProjectsFolderFormDrawerService} from "./projects-folder-form-drawer.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {IProjectFolder} from "@interfaces/project-folder";

@Component({
  selector: 'worklenz-projects-folder-form-drawer',
  templateUrl: './projects-folder-form-drawer.component.html',
  styleUrls: ['./projects-folder-form-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsFolderFormDrawerComponent {
  @ViewChild('nameInput', {static: false}) nameInput!: ElementRef;
  @Input() folderId: string | null = null;

  form!: FormGroup;

  show = false;
  loading = false;

  readonly COLOR_CODES = ProjectsDefaultColorCodes;
  private createCallback: FolderCreateEventCallback | null = null;

  get activeColor() {
    return this.form.controls['color_code'].value;
  }

  get title() {
    return this.folderId ? "Update the folder" : "Create a folder";
  }

  get buttonText() {
    return this.folderId ? "Update" : "Create";
  }

  get valid() {
    return this.form.valid;
  }

  constructor(
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly api: ProjectFoldersApiService,
    private readonly service: ProjectsFolderFormDrawerService
  ) {
    this.form = this.fb.group({
      name: [null, [Validators.required]],
      color_code: [null]
    });

    this.service.onCreateInvoke
      .pipe(takeUntilDestroyed())
      .subscribe((callback) => {
        this.createCallback = callback;
        this.open();
      });
  }

  public open() {
    this.show = true;
    this.cdr.markForCheck();
  }

  public close() {
    this.show = false;
    this.form.reset({
      name: null,
      color_code: null
    });
    this.invokeCreate();
    this.cdr.markForCheck();
  }

  invokeCreate(folder?: IProjectFolder) {
    if (this.createCallback) {
      this.createCallback(folder);
      this.createCallback = null;
    }
  }

  async submit() {
    if (this.form.invalid) return;
    try {
      this.loading = true;
      const body = {
        name: this.form.value.name,
        color_code: this.form.value.color_code
      };
      const res = await this.api.create(body);
      if (res.done) {
        this.invokeCreate(res.body);
        this.close();
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  setColorCode(colorCode: string) {
    this.form.controls["color_code"].setValue(colorCode);
  }

  onVisibilityChange(visible: boolean) {
    if (visible) {
      this.setFocusToNameInput();
    }
  }

  private setFocusToNameInput() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        const element = this.nameInput.nativeElement as HTMLInputElement;
        if (element)
          element.focus();
      }, 100);
    });
  }
}
