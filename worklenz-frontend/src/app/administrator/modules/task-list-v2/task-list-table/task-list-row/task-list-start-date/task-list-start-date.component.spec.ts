import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListStartDateComponent} from './task-list-start-date.component';

describe('TaskListStartDateComponent', () => {
  let component: TaskListStartDateComponent;
  let fixture: ComponentFixture<TaskListStartDateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListStartDateComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListStartDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
