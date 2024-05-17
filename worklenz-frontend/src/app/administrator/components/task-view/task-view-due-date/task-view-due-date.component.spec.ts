import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewDueDateComponent} from './task-view-due-date.component';

describe('TaskViewDueDateComponent', () => {
  let component: TaskViewDueDateComponent;
  let fixture: ComponentFixture<TaskViewDueDateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewDueDateComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewDueDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
