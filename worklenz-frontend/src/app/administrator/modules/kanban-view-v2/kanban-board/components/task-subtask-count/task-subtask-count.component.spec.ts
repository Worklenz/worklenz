import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskSubtaskCountComponent} from './task-subtask-count.component';

describe('TaskSubtaskCountComponent', () => {
  let component: TaskSubtaskCountComponent;
  let fixture: ComponentFixture<TaskSubtaskCountComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskSubtaskCountComponent]
    });
    fixture = TestBed.createComponent(TaskSubtaskCountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
