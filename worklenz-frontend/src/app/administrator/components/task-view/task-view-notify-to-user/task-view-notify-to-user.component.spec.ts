import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewNotifyToUserComponent} from './task-view-notify-to-user.component';

describe('TaskViewNotifyToUserComponent', () => {
  let component: TaskViewNotifyToUserComponent;
  let fixture: ComponentFixture<TaskViewNotifyToUserComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskViewNotifyToUserComponent]
    });
    fixture = TestBed.createComponent(TaskViewNotifyToUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
