import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListContextMenuComponent} from './task-list-context-menu.component';

describe('TaskListContextMenuComponent', () => {
  let component: TaskListContextMenuComponent;
  let fixture: ComponentFixture<TaskListContextMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListContextMenuComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListContextMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
