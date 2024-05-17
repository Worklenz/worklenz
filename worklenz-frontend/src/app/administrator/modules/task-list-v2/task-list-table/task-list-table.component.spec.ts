import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListTableComponent} from './task-list-table.component';

describe('TaskListTableComponent', () => {
  let component: TaskListTableComponent;
  let fixture: ComponentFixture<TaskListTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListTableComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
