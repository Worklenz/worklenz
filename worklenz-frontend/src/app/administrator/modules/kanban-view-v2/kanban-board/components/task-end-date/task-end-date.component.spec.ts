import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskEndDateComponent} from './task-end-date.component';

describe('TaskEndDateComponent', () => {
  let component: TaskEndDateComponent;
  let fixture: ComponentFixture<TaskEndDateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskEndDateComponent]
    });
    fixture = TestBed.createComponent(TaskEndDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
