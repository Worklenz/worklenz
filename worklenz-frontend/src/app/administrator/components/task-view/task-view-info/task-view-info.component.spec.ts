import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewInfoComponent} from './task-view-info.component';

describe('TaskViewInfoComponent', () => {
  let component: TaskViewInfoComponent;
  let fixture: ComponentFixture<TaskViewInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskViewInfoComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
