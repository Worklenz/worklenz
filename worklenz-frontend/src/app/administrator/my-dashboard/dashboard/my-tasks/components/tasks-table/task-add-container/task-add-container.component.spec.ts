import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskAddContainerComponent} from './task-add-container.component';

describe('TaskAddContainerComponent', () => {
  let component: TaskAddContainerComponent;
  let fixture: ComponentFixture<TaskAddContainerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskAddContainerComponent]
    });
    fixture = TestBed.createComponent(TaskAddContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
