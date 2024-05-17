import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskViewDescriptionComponent} from './task-view-description.component';

describe('TaskViewDescriptionComponent', () => {
  let component: TaskViewDescriptionComponent;
  let fixture: ComponentFixture<TaskViewDescriptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskViewDescriptionComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskViewDescriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
