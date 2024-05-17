import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskDueDateComponent} from './task-due-date.component';

describe('TaskDueDateComponent', () => {
  let component: TaskDueDateComponent;
  let fixture: ComponentFixture<TaskDueDateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskDueDateComponent]
    });
    fixture = TestBed.createComponent(TaskDueDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
