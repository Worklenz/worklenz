import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptTeamDrawerProjectsComponent} from './rpt-team-drawer-projects.component';

describe('RptTeamDrawerProjectsComponent', () => {
  let component: RptTeamDrawerProjectsComponent;
  let fixture: ComponentFixture<RptTeamDrawerProjectsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptTeamDrawerProjectsComponent]
    });
    fixture = TestBed.createComponent(RptTeamDrawerProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
