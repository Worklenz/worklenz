import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListLabelsComponent} from './task-list-labels.component';

describe('TaskListLabelsComponent', () => {
  let component: TaskListLabelsComponent;
  let fixture: ComponentFixture<TaskListLabelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListLabelsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListLabelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
