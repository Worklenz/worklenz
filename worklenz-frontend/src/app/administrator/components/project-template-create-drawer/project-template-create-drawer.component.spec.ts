import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectTemplateCreateDrawerComponent } from './project-template-create-drawer.component';

describe('ProjectTemplateCreateDrawerComponent', () => {
  let component: ProjectTemplateCreateDrawerComponent;
  let fixture: ComponentFixture<ProjectTemplateCreateDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectTemplateCreateDrawerComponent]
    });
    fixture = TestBed.createComponent(ProjectTemplateCreateDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
