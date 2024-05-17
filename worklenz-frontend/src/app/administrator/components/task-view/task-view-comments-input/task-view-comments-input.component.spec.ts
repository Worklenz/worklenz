import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewCommentsInputComponent} from './task-view-comments-input.component';

describe('TaskViewCommentsInputComponent', () => {
  let component: TaskViewCommentsInputComponent;
  let fixture: ComponentFixture<TaskViewCommentsInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewCommentsInputComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewCommentsInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
