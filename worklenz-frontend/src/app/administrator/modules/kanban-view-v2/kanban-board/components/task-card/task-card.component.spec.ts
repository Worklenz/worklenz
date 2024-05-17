import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskCardComponent} from './task-card.component';

describe('TaskCardComponent', () => {
  let component: TaskCardComponent;
  let fixture: ComponentFixture<TaskCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskCardComponent]
    });
    fixture = TestBed.createComponent(TaskCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
