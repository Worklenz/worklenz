import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectInsightsMemberOverviewComponent} from './project-insights-member-overview.component';

describe('OverviewComponent', () => {
  let component: ProjectInsightsMemberOverviewComponent;
  let fixture: ComponentFixture<ProjectInsightsMemberOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectInsightsMemberOverviewComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectInsightsMemberOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
