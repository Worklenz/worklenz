import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectTemplatesComponent } from './project-templates.component';

describe('ProjectTemplatesComponent', () => {
  let component: ProjectTemplatesComponent;
  let fixture: ComponentFixture<ProjectTemplatesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectTemplatesComponent]
    });
    fixture = TestBed.createComponent(ProjectTemplatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
