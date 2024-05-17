import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewAttachmentsThumbComponent} from './task-view-attachments-thumb.component';

describe('TaskViewAttachmentsThumbComponent', () => {
  let component: TaskViewAttachmentsThumbComponent;
  let fixture: ComponentFixture<TaskViewAttachmentsThumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewAttachmentsThumbComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewAttachmentsThumbComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
