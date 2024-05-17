import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskPriorityComponent } from './task-priority.component';

describe('TaskPriorityComponent', () => {
  let component: TaskPriorityComponent;
  let fixture: ComponentFixture<TaskPriorityComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskPriorityComponent]
    });
    fixture = TestBed.createComponent(TaskPriorityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
