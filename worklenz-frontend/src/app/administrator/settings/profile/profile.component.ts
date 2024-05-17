import {ApplicationRef, Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";

import {ProfileSettingsApiService} from "@api/profile-settings-api.service";
import {IProfileSettings} from "@interfaces/profile-settings";
import {AppService} from "@services/app.service";
import {AuthService} from "@services/auth.service";
import {dispatchProfilePictureChange, dispatchProfileUpdate} from "@shared/events";
import {getBase64, log_error} from "@shared/utils";
import {AttachmentsApiService} from "@api/attachments-api.service";

@Component({
  selector: 'worklenz-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  form!: FormGroup;

  model: IProfileSettings = {};

  loading = false;
  updating = false;
  uploading = false;
  avatarUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private api: ProfileSettingsApiService,
    private app: AppService,
    private auth: AuthService,
    private attachmentsApi: AttachmentsApiService,
    private ref: ApplicationRef
  ) {
    this.app.setTitle("Profile Settings");

    this.form = this.fb.group({
      name: [null, Validators.required],
      email: [null, Validators.required]
    });

    this.avatarUrl = this.profile?.avatar_url || null;
    this.form.controls["email"].disable();
  }

  get profile() {
    return this.auth.getCurrentSession();
  }

  async ngOnInit() {
    await this.get();
  }

  isInvalidForm() {
    return this.form.invalid;
  }

  async get() {
    this.loading = true;
    try {
      const res = await this.api.get();
      if (res.done) {
        this.model = res.body;
        this.form.controls["name"].setValue(this.model.name);
        this.form.controls["email"].setValue(this.model.email);
        if (this.profile?.is_google)
          this.form.controls["email"].disable();
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
  }

  async submit() {
    if (this.form.invalid) {
      this.app.displayErrorsOf(this.form);
      return;
    }

    this.updating = true;
    try {
      const body = {
        name: this.form.controls["name"].value,
        // email: this.form.controls["email"].value
      };
      const res = await this.api.update(body);
      if (res.done) {
        await this.get();
        await this.auth.authorize();
        dispatchProfileUpdate();
      }
      this.updating = false;
    } catch (e) {
      this.updating = false;
      log_error(e);
    }
  }

  async uploadFile(input: HTMLInputElement) {
    if (this.uploading) return;

    try {
      const files = input.files || [];

      if (!files || !files.length) return;

      const file = files[0];

      this.uploading = true;

      const base64 = await getBase64(file);
      const res = await this.attachmentsApi.createAvatarAttachment({
        file: base64 as string,
        file_name: file.name,
        size: file.size
      });
      if (res.done) {
        await this.auth.authorize();
        dispatchProfilePictureChange();
        this.avatarUrl = res.body.url;
      }
      this.uploading = false;
    } catch (e) {
      this.uploading = false;
    }

    // Reset file input
    const dt = new DataTransfer();
    input.files = dt.files;
  }
}
