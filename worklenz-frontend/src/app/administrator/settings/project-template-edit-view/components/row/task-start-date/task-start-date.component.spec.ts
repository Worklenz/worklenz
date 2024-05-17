import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskStartDateComponent } from './task-start-date.component';

describe('TaskStartDateComponent', () => {
  let component: TaskStartDateComponent;
  let fixture: ComponentFixture<TaskStartDateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskStartDateComponent]
    });
    fixture = TestBed.createComponent(TaskStartDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
