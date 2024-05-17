import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListRowComponent} from './task-list-row.component';

describe('TaskListRowComponent', () => {
  let component: TaskListRowComponent;
  let fixture: ComponentFixture<TaskListRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListRowComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
