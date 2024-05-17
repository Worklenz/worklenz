import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TasksProgressBarComponent} from './tasks-progress-bar.component';

describe('TasksProgressBarComponent', () => {
  let component: TasksProgressBarComponent;
  let fixture: ComponentFixture<TasksProgressBarComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TasksProgressBarComponent]
    });
    fixture = TestBed.createComponent(TasksProgressBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
