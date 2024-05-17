import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicensingAlertsComponent } from './licensing-alerts.component';

describe('LicensingAlertsComponent', () => {
  let component: LicensingAlertsComponent;
  let fixture: ComponentFixture<LicensingAlertsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LicensingAlertsComponent]
    });
    fixture = TestBed.createComponent(LicensingAlertsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
