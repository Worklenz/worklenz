import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskListPhaseDurationComponent } from './task-list-phase-duration.component';

describe('TaskListPhaseDuratinoComponent', () => {
  let component: TaskListPhaseDurationComponent;
  let fixture: ComponentFixture<TaskListPhaseDurationComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskListPhaseDurationComponent]
    });
    fixture = TestBed.createComponent(TaskListPhaseDurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
