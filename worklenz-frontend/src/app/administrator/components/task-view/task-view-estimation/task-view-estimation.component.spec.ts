import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewEstimationComponent} from './task-view-estimation.component';

describe('TaskViewEstimationComponent', () => {
  let component: TaskViewEstimationComponent;
  let fixture: ComponentFixture<TaskViewEstimationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewEstimationComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewEstimationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
