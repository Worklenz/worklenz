import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TaskTemplateDrawerComponent} from './task-template-drawer.component';

describe('TaskTemplateDrawerComponent', () => {
  let component: TaskTemplateDrawerComponent;
  let fixture: ComponentFixture<TaskTemplateDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskTemplateDrawerComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TaskTemplateDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
