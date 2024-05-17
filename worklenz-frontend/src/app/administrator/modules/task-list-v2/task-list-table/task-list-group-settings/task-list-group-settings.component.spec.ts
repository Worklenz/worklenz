import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListGroupSettingsComponent} from './task-list-group-settings.component';

describe('TaskListGroupSettingsComponent', () => {
  let component: TaskListGroupSettingsComponent;
  let fixture: ComponentFixture<TaskListGroupSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListGroupSettingsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListGroupSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
