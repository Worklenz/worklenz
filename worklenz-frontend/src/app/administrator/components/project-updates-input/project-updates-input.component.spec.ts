import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectUpdatesInputComponent } from './project-updates-input.component';

describe('ProjectUpdatesInputComponent', () => {
  let component: ProjectUpdatesInputComponent;
  let fixture: ComponentFixture<ProjectUpdatesInputComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectUpdatesInputComponent]
    });
    fixture = TestBed.createComponent(ProjectUpdatesInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
