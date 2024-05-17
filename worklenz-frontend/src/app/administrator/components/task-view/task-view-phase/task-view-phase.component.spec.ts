import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewPhaseComponent} from './task-view-phase.component';

describe('TaskViewPhaseComponent', () => {
  let component: TaskViewPhaseComponent;
  let fixture: ComponentFixture<TaskViewPhaseComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskViewPhaseComponent]
    });
    fixture = TestBed.createComponent(TaskViewPhaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
