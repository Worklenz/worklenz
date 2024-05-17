import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectStatusComponent } from './project-status.component';

describe('ProjectStatusComponent', () => {
  let component: ProjectStatusComponent;
  let fixture: ComponentFixture<ProjectStatusComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectStatusComponent]
    });
    fixture = TestBed.createComponent(ProjectStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
