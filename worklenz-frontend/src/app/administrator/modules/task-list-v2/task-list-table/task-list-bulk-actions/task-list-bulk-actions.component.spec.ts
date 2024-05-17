import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListBulkActionsComponent} from './task-list-bulk-actions.component';

describe('TaskListBulkActionsComponent', () => {
  let component: TaskListBulkActionsComponent;
  let fixture: ComponentFixture<TaskListBulkActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListBulkActionsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListBulkActionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
