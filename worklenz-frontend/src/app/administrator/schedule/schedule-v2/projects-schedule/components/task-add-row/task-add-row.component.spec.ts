import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskAddRowComponent } from './task-add-row.component';

describe('TaskAddRowComponent', () => {
  let component: TaskAddRowComponent;
  let fixture: ComponentFixture<TaskAddRowComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskAddRowComponent]
    });
    fixture = TestBed.createComponent(TaskAddRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
