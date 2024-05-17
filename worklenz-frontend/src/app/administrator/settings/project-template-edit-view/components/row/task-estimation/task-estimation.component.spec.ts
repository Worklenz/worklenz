import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskEstimationComponent } from './task-estimation.component';

describe('TaskEstimationComponent', () => {
  let component: TaskEstimationComponent;
  let fixture: ComponentFixture<TaskEstimationComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskEstimationComponent]
    });
    fixture = TestBed.createComponent(TaskEstimationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
