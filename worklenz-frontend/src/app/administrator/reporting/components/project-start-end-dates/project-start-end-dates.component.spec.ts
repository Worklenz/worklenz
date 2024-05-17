import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectStartEndDatesComponent } from './project-start-end-dates.component';

describe('ProjectStartEndDatesComponent', () => {
  let component: ProjectStartEndDatesComponent;
  let fixture: ComponentFixture<ProjectStartEndDatesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectStartEndDatesComponent]
    });
    fixture = TestBed.createComponent(ProjectStartEndDatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
