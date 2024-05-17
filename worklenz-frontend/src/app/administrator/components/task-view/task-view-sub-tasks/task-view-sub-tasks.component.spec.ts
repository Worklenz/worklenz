import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewSubTasksComponent} from './task-view-sub-tasks.component';

describe('TaskViewSubTasksComponent', () => {
  let component: TaskViewSubTasksComponent;
  let fixture: ComponentFixture<TaskViewSubTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewSubTasksComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewSubTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
