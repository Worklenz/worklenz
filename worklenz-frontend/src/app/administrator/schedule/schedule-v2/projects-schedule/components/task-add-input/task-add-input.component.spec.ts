import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskAddInputComponent } from './task-add-input.component';

describe('TaskAddInputComponent', () => {
  let component: TaskAddInputComponent;
  let fixture: ComponentFixture<TaskAddInputComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskAddInputComponent]
    });
    fixture = TestBed.createComponent(TaskAddInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
