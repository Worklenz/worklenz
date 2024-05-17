import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListMembersComponent} from './task-list-members.component';

describe('TaskListMembersComponent', () => {
  let component: TaskListMembersComponent;
  let fixture: ComponentFixture<TaskListMembersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListMembersComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
