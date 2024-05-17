import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskNameComponent } from './task-name.component';

describe('TaskNameComponent', () => {
  let component: TaskNameComponent;
  let fixture: ComponentFixture<TaskNameComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskNameComponent]
    });
    fixture = TestBed.createComponent(TaskNameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
