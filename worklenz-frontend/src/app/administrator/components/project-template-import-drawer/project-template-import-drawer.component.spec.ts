import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectTemplateImportDrawerComponent } from './project-template-import-drawer.component';

describe('ProjectTemplateImportDrawerComponent', () => {
  let component: ProjectTemplateImportDrawerComponent;
  let fixture: ComponentFixture<ProjectTemplateImportDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectTemplateImportDrawerComponent]
    });
    fixture = TestBed.createComponent(ProjectTemplateImportDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
