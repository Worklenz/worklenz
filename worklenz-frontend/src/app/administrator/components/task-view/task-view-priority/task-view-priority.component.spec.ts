import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewPriorityComponent} from './task-view-priority.component';

describe('TaskViewPriorityComponent', () => {
  let component: TaskViewPriorityComponent;
  let fixture: ComponentFixture<TaskViewPriorityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewPriorityComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewPriorityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
