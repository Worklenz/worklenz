import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewAttachmentsComponent} from './task-view-attachments.component';

describe('TaskViewAttachmentsComponent', () => {
  let component: TaskViewAttachmentsComponent;
  let fixture: ComponentFixture<TaskViewAttachmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewAttachmentsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewAttachmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
