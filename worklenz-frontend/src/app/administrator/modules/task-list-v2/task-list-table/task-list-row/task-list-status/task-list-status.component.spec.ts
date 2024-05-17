import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListStatusComponent} from './task-list-status.component';

describe('TaskListStatusComponent', () => {
  let component: TaskListStatusComponent;
  let fixture: ComponentFixture<TaskListStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListStatusComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
