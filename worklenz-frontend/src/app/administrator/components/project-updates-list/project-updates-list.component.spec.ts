import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectUpdatesListComponent } from './project-updates-list.component';

describe('ProjectUpdatesListComponent', () => {
  let component: ProjectUpdatesListComponent;
  let fixture: ComponentFixture<ProjectUpdatesListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectUpdatesListComponent]
    });
    fixture = TestBed.createComponent(ProjectUpdatesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
