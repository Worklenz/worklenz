import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectDeadlineComponent} from './project-deadline.component';

describe('ProjectDeadlineComponent', () => {
  let component: ProjectDeadlineComponent;
  let fixture: ComponentFixture<ProjectDeadlineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectDeadlineComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectDeadlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
