import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskListFiltersComponent} from './task-list-filters.component';

describe('TaskListFiltersComponent', () => {
  let component: TaskListFiltersComponent;
  let fixture: ComponentFixture<TaskListFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskListFiltersComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskListFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
