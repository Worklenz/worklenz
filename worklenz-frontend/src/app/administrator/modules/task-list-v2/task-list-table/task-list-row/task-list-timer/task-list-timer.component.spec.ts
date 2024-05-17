import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListTimerComponent} from './task-list-timer.component';

describe('TaskListTimerComponent', () => {
  let component: TaskListTimerComponent;
  let fixture: ComponentFixture<TaskListTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListTimerComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
