import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectMemberTasksDrawerComponent } from './project-member-tasks-drawer.component';

describe('ProjectMemberTasksDrawerComponent', () => {
  let component: ProjectMemberTasksDrawerComponent;
  let fixture: ComponentFixture<ProjectMemberTasksDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectMemberTasksDrawerComponent]
    });
    fixture = TestBed.createComponent(ProjectMemberTasksDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
