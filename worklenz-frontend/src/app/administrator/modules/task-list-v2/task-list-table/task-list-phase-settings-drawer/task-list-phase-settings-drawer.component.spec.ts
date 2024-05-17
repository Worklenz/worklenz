import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListPhaseSettingsDrawerComponent} from './task-list-phase-settings-drawer.component';

describe('TaskListPhaseSettingsDrawerComponent', () => {
  let component: TaskListPhaseSettingsDrawerComponent;
  let fixture: ComponentFixture<TaskListPhaseSettingsDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskListPhaseSettingsDrawerComponent]
    });
    fixture = TestBed.createComponent(TaskListPhaseSettingsDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
