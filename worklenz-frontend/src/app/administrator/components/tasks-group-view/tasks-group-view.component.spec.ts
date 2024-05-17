import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TasksGroupViewComponent} from './tasks-group-view.component';

describe('TasksGroupViewComponent', () => {
  let component: TasksGroupViewComponent;
  let fixture: ComponentFixture<TasksGroupViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TasksGroupViewComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TasksGroupViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
