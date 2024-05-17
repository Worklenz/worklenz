import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectsTasksComponent} from './projects-tasks.component';

describe('ProjectsTasksComponent', () => {
  let component: ProjectsTasksComponent;
  let fixture: ComponentFixture<ProjectsTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectsTasksComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectsTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
