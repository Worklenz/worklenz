import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskPriorityLabelComponent} from './task-priority-label.component';

describe('TaskPriorityLabelComponent', () => {
  let component: TaskPriorityLabelComponent;
  let fixture: ComponentFixture<TaskPriorityLabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskPriorityLabelComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskPriorityLabelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
