import {Component, ElementRef, NgZone, OnInit, ViewChild} from '@angular/core';
import {AccountCenterApiService} from "@api/account-center-api.service";
import {log_error} from "@shared/utils";
import {IOrganization, IOrganizationAdmin} from "@interfaces/account-center";

@Component({
  selector: 'worklenz-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnInit {
  @ViewChild('numberInput') private numberInput: ElementRef | undefined;
  loadingName = false;
  loadingAdmins = false;
  isNumberEditing = false;

  organizationDetails: IOrganization = {};
  organizationAdmins: IOrganizationAdmin[] = [];

  constructor(
    private api: AccountCenterApiService,
    private readonly ngZone: NgZone) {
  }

  ngOnInit() {
    void this.getOrganizationName();
    void this.getOrganizationAdmins();
  }

  async getOrganizationName() {
    try {
      this.loadingName = true;
      const res = await this.api.getOrganizationName();
      if (res.done) {
        this.loadingName = false;
        this.organizationDetails = res.body;
      }
    } catch (e) {
      this.loadingName = false;
      log_error(e);
    }
  }

  async getOrganizationAdmins() {
    try {
      this.loadingAdmins = true;
      const res = await this.api.getOrganizationAdmins();
      if (res.done) {
        this.loadingAdmins = false;
        this.organizationAdmins = res.body;
      }
    } catch (e) {
      this.loadingAdmins = false;
      log_error(e);
    }
  }

  async updateOrganizationName() {
    try {
      this.loadingName = true;
      const res = await this.api.updateOrganizationName({name: this.organizationDetails.name});
      if (res.done) {
        this.loadingName = false;
      }
    } catch (e) {
      this.loadingName = false;
      log_error(e);
    }
    await this.getOrganizationName();
  }

  async updateOwnerContactNumber() {
    try {
      this.loadingName = true;
      this.isNumberEditing = false;
      const res = await this.api.updateOwnerContactNumber({contact_number: this.organizationDetails.contact_number || ''});
      if (res.done) {
        this.loadingName = false;
        await this.getOrganizationName();
      }
    } catch (e) {
      this.loadingName = false;
      log_error(e);
    }
  }

  focusNumberInput() {
    this.isNumberEditing = true;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.numberInput?.nativeElement.focus();
        this.numberInput?.nativeElement.select();
      }, 100)
    });
  }

  sanitizeContactNumber(event: any) {
    const input = event.target as HTMLInputElement;
    const sanitizedValue = input.value.replace(/[^0-9()+ -]/g, '');
    this.organizationDetails.contact_number = sanitizedValue;

  }

}
