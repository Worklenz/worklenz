import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TasksContextMenuComponent } from './tasks-context-menu.component';

describe('TasksContextMenuComponent', () => {
  let component: TasksContextMenuComponent;
  let fixture: ComponentFixture<TasksContextMenuComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TasksContextMenuComponent]
    });
    fixture = TestBed.createComponent(TasksContextMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
