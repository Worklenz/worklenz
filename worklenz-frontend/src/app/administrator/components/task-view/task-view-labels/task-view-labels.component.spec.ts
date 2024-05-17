import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewLabelsComponent} from './task-view-labels.component';

describe('TaskViewLabelsComponent', () => {
  let component: TaskViewLabelsComponent;
  let fixture: ComponentFixture<TaskViewLabelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewLabelsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewLabelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
