import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectIndicatorComponent } from './project-indicator.component';

describe('ProjectIndicatorComponent', () => {
  let component: ProjectIndicatorComponent;
  let fixture: ComponentFixture<ProjectIndicatorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectIndicatorComponent]
    });
    fixture = TestBed.createComponent(ProjectIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
