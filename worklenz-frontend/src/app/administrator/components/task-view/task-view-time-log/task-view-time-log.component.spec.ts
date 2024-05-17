import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewTimeLogComponent} from './task-view-time-log.component';

describe('TaskViewTimeLogComponent', () => {
  let component: TaskViewTimeLogComponent;
  let fixture: ComponentFixture<TaskViewTimeLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewTimeLogComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewTimeLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
