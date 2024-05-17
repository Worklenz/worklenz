import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewActivityLogComponent} from './task-view-activity-log.component';

describe('TaskViewActivityLogComponent', () => {
  let component: TaskViewActivityLogComponent;
  let fixture: ComponentFixture<TaskViewActivityLogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskViewActivityLogComponent]
    });
    fixture = TestBed.createComponent(TaskViewActivityLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
