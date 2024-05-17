import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusSettingsDrawerComponent } from './status-settings-drawer.component';

describe('StatusSettingsDrawerComponent', () => {
  let component: StatusSettingsDrawerComponent;
  let fixture: ComponentFixture<StatusSettingsDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StatusSettingsDrawerComponent]
    });
    fixture = TestBed.createComponent(StatusSettingsDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
