import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskCreationAssigneesComponent} from './task-creation-assignees.component';

describe('TaskCreationAssigneesComponent', () => {
  let component: TaskCreationAssigneesComponent;
  let fixture: ComponentFixture<TaskCreationAssigneesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskCreationAssigneesComponent]
    });
    fixture = TestBed.createComponent(TaskCreationAssigneesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
