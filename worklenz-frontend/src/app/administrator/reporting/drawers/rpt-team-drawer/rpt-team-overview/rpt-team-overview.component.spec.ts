import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RptTeamOverviewComponent } from './rpt-team-overview.component';

describe('RptTeamOverviewComponent', () => {
  let component: RptTeamOverviewComponent;
  let fixture: ComponentFixture<RptTeamOverviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptTeamOverviewComponent]
    });
    fixture = TestBed.createComponent(RptTeamOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
