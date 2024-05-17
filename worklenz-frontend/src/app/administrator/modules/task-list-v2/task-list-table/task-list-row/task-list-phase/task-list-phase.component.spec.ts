import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListPhaseComponent} from './task-list-phase.component';

describe('TaskListPhaseComponent', () => {
  let component: TaskListPhaseComponent;
  let fixture: ComponentFixture<TaskListPhaseComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskListPhaseComponent]
    });
    fixture = TestBed.createComponent(TaskListPhaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
