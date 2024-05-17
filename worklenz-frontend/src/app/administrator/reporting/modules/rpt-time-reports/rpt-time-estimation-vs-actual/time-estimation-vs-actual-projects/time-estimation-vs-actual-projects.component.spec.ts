import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeEstimationVsActualProjectsComponent } from './time-estimation-vs-actual-projects.component';

describe('TimeEstimationVsActualProjectsComponent', () => {
  let component: TimeEstimationVsActualProjectsComponent;
  let fixture: ComponentFixture<TimeEstimationVsActualProjectsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TimeEstimationVsActualProjectsComponent]
    });
    fixture = TestBed.createComponent(TimeEstimationVsActualProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
