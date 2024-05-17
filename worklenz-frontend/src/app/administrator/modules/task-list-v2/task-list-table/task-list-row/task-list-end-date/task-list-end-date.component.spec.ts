import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListEndDateComponent} from './task-list-end-date.component';

describe('TaskListEndDateComponent', () => {
  let component: TaskListEndDateComponent;
  let fixture: ComponentFixture<TaskListEndDateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListEndDateComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListEndDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
