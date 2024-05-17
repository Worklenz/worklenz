import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListPriorityComponent} from './task-list-priority.component';

describe('TaskListPriorityComponent', () => {
  let component: TaskListPriorityComponent;
  let fixture: ComponentFixture<TaskListPriorityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListPriorityComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListPriorityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
