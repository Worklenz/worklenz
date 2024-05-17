import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {ITeamMembersViewModel} from "@interfaces/api-models/team-members-view-model";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {isValidateEmail, log_error} from "@shared/utils";
import {NzSelectComponent, NzSelectModule} from "ng-zorro-antd/select";
import {NgForOf, NgIf} from "@angular/common";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzButtonModule} from "ng-zorro-antd/button";
import {ActivatedRoute} from "@angular/router";
import {ITeamMember} from "@interfaces/team-member";
import {ProjectMembersApiService} from "@api/project-members-api.service";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";
import {ProjectsService} from "../../projects/projects.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-team-members-autocomplete',
  templateUrl: './team-members-autocomplete.component.html',
  styleUrls: ['./team-members-autocomplete.component.scss'],
  imports: [
    NzSelectModule,
    NgIf,
    NzTypographyModule,
    ReactiveFormsModule,
    NzFormModule,
    NgForOf,
    NzIconModule,
    NzAvatarModule,
    NzToolTipModule,
    NzButtonModule,
    FirstCharUpperPipe
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamMembersAutocompleteComponent implements OnInit, AfterViewInit {
  @ViewChild("searchInput") searchInput!: NzSelectComponent;

  @Output() refresh: EventEmitter<void> = new EventEmitter();

  @Output() membersChange: EventEmitter<string | string[]> = new EventEmitter<string | string[]>();
  @Input() members: string | string[] = [];

  @Input() placeholder = 'Select Members';
  @Input() label: string | null = 'Members';

  @Input() multiple = false;
  @Input() disabled = false;
  @Input() autofocus = false;
  @Input() disableTeamInvites = false;

  form!: FormGroup;

  loading = false;
  searching = false;
  inviting = false;

  model: ITeamMembersViewModel = {};

  searchingName: string | null = null;

  projectId: string | null = null;

  get buttonText() {
    return this.isValueIsAnEmail() ? 'Invite as a member' : 'Invite a new member by email';
  }

  constructor(
    private readonly api: TeamMembersApiService,
    private readonly membersApi: ProjectMembersApiService,
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly projectsService: ProjectsService,
    private readonly auth: AuthService
  ) {
    // The id currently only consumed under a project with id param.
    this.projectId = this.route.snapshot.paramMap.get("id");

    this.form = this.fb.group({
      members: []
    });

    this.form.controls["members"]?.valueChanges.subscribe((value: string[]) => {
      this.emitChanges(value);
    });
  }

  async ngOnInit() {
    this.form.controls["members"].setValue(this.members || []);
    await this.init();
    this.cdr.detectChanges();
  }

  ngAfterViewInit() {
    if (this.autofocus) {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.searchInput.setOpenState(true);
        }, DRAWER_ANIMATION_INTERVAL);
      });
      this.cdr.detectChanges();
    }
  }

  async init() {
    this.loading = true;
    await this.get();
    this.loading = false;
    this.cdr.detectChanges();
  }

  async get() {
    try {
      const res = await this.api.get(1, 5, 'name', null, this.searchingName);
      if (res.done) {
        this.model = res.body;
      }
      this.cdr.detectChanges();
    } catch (e) {
      log_error(e);
      this.cdr.detectChanges();
    }
  }

  async search(value: string) {
    this.searchingName = value;
    this.searching = true;
    await this.get();
    this.searching = false;
    this.cdr.detectChanges();
  }

  public reset() {
    this.form.reset();
    this.searchingName = null;
    void this.init();
    this.cdr.detectChanges();
  }

  private emitChanges(newMemberIds: string | string[]) {
    this.members = newMemberIds;
    this.membersChange.emit(newMemberIds);
    this.cdr.detectChanges();
  }

  trackById(index: number, item: ITeamMember) {
    return item.id;
  }

  isValueIsAnEmail() {
    if (!this.searchingName) return false;
    return isValidateEmail(this.searchingName);
  }

  private resetSearchInput() {
    this.reset();
    this.searchInput.clearInput();
    this.searchInput.focus();
    this.cdr.detectChanges();
  }

  @HostListener("document:keydown", ["$event"])
  handleEnterKeyPress(event: KeyboardEvent) {
    if (event.code === "Enter" && this.isValueIsAnEmail())
      void this.sendInvitation();
  }

  async sendInvitation() {
    if (!this.projectId) return;
    if (typeof this.searchingName !== "string" || !this.searchingName.length) return;

    try {
      const email = this.searchingName.trim().toLowerCase();
      const request = {
        project_id: this.projectId,
        email
      };
      this.inviting = true;
      const res = await this.membersApi.createByEmail(request);
      this.inviting = false;
      if (res.done) {
        this.resetSearchInput();
        this.refresh?.emit();
      }
      this.cdr.detectChanges();
    } catch (e) {
      this.inviting = false;
      this.cdr.detectChanges();
    }
  }
}
