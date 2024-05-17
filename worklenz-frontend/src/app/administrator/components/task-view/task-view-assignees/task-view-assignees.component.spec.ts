import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewAssigneesComponent} from './task-view-assignees.component';

describe('TaskViewAssigneesComponent', () => {
  let component: TaskViewAssigneesComponent;
  let fixture: ComponentFixture<TaskViewAssigneesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewAssigneesComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewAssigneesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
