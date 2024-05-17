import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectInsightsComponent} from './project-insights.component';

describe('ProjectInsightsComponent', () => {
  let component: ProjectInsightsComponent;
  let fixture: ComponentFixture<ProjectInsightsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectInsightsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectInsightsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
