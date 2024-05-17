import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskListHeaderComponent } from './task-list-header.component';

describe('TaskListHeaderComponent', () => {
  let component: TaskListHeaderComponent;
  let fixture: ComponentFixture<TaskListHeaderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskListHeaderComponent]
    });
    fixture = TestBed.createComponent(TaskListHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
