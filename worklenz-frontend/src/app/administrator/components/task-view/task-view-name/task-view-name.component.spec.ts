import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewNameComponent} from './task-view-name.component';

describe('TaskViewNameComponent', () => {
  let component: TaskViewNameComponent;
  let fixture: ComponentFixture<TaskViewNameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewNameComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewNameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
