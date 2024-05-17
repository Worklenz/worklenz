import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectUpdatesDrawerComponent } from './project-updates-drawer.component';

describe('ProjectUpdatesDrawerComponent', () => {
  let component: ProjectUpdatesDrawerComponent;
  let fixture: ComponentFixture<ProjectUpdatesDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectUpdatesDrawerComponent]
    });
    fixture = TestBed.createComponent(ProjectUpdatesDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
