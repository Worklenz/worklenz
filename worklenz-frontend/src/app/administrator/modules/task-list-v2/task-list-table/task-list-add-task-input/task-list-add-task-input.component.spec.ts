import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListAddTaskInputComponent} from './task-list-add-task-input.component';

describe('TaskListAddTaskInputComponent', () => {
  let component: TaskListAddTaskInputComponent;
  let fixture: ComponentFixture<TaskListAddTaskInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListAddTaskInputComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListAddTaskInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
