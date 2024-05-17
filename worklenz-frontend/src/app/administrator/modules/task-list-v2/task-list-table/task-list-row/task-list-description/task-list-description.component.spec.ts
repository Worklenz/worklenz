import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListDescriptionComponent} from './task-list-description.component';

describe('TaskListDescriptionComponent', () => {
  let component: TaskListDescriptionComponent;
  let fixture: ComponentFixture<TaskListDescriptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListDescriptionComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListDescriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
