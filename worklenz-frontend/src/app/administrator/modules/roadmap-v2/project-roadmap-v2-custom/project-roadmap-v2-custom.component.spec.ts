import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectRoadmapV2CustomComponent } from './project-roadmap-v2-custom.component';

describe('ProjectRoadmapV2CustomComponent', () => {
  let component: ProjectRoadmapV2CustomComponent;
  let fixture: ComponentFixture<ProjectRoadmapV2CustomComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectRoadmapV2CustomComponent]
    });
    fixture = TestBed.createComponent(ProjectRoadmapV2CustomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
