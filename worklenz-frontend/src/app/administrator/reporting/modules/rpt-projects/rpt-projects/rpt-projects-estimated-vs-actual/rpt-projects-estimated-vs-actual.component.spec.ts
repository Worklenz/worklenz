import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RptProjectsEstimatedVsActualComponent } from './rpt-projects-estimated-vs-actual.component';

describe('RptProjectsEstimatedVsActualComponent', () => {
  let component: RptProjectsEstimatedVsActualComponent;
  let fixture: ComponentFixture<RptProjectsEstimatedVsActualComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptProjectsEstimatedVsActualComponent]
    });
    fixture = TestBed.createComponent(RptProjectsEstimatedVsActualComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
