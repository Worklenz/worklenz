import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectTemplateEditViewComponent } from './project-template-edit-view.component';

describe('ProjectTemplateEditViewComponent', () => {
  let component: ProjectTemplateEditViewComponent;
  let fixture: ComponentFixture<ProjectTemplateEditViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectTemplateEditViewComponent]
    });
    fixture = TestBed.createComponent(ProjectTemplateEditViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
