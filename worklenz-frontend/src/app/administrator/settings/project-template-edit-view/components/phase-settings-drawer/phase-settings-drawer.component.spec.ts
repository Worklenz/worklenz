import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhaseSettingsDrawerComponent } from './phase-settings-drawer.component';

describe('PhaseSettingsDrawerComponent', () => {
  let component: PhaseSettingsDrawerComponent;
  let fixture: ComponentFixture<PhaseSettingsDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PhaseSettingsDrawerComponent]
    });
    fixture = TestBed.createComponent(PhaseSettingsDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
