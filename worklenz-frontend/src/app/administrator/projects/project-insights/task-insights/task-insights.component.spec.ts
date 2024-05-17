import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskInsightsComponent} from './task-insights.component';

describe('TaskInsightsComponent', () => {
  let component: TaskInsightsComponent;
  let fixture: ComponentFixture<TaskInsightsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskInsightsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskInsightsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
