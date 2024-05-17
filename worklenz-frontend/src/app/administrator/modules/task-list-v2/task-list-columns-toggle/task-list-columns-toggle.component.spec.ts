import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListColumnsToggleComponent} from './task-list-columns-toggle.component';

describe('TaskListColumnsToggleComponent', () => {
  let component: TaskListColumnsToggleComponent;
  let fixture: ComponentFixture<TaskListColumnsToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListColumnsToggleComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListColumnsToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
