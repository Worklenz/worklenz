import {Component, OnInit} from '@angular/core';
import {AppService} from "@services/app.service";
import {TimezonesApiService} from "@api/timezones-api.service";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ITimezone} from "@interfaces/timezone";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-language-and-region',
  templateUrl: './language-and-region.component.html',
  styleUrls: ['./language-and-region.component.scss']
})
export class LanguageAndRegionComponent implements OnInit {
  form!: FormGroup;

  loading = false;
  updating = false;
  options: string[] = ['English'];

  timezones: ITimezone[] = [];

  constructor(
    private app: AppService,
    private api: TimezonesApiService,
    private fb: FormBuilder,
    private auth: AuthService
  ) {
    this.app.setTitle("Language & Region");

    const profile = this.auth.getCurrentSession();

    this.form = this.fb.group({
      language: ['English', Validators.required],
      timezone: [profile?.timezone || null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.get();
  }

  async submit() {
    if (this.form.invalid)
      return this.app.displayErrorsOf(this.form);

    try {
      this.updating = true;
      const res = await this.api.update(this.form.value);
      if (res.done) {
        await this.auth.authorize();
      }
      this.updating = false;
    } catch (e) {
      this.updating = false;
    }
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.get();
      if (res.done) {
        this.timezones = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }
  }
}
