import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptTeamDrawerMembersComponent} from './rpt-team-drawer-members.component';

describe('RptTeamDrawerMembersComponent', () => {
  let component: RptTeamDrawerMembersComponent;
  let fixture: ComponentFixture<RptTeamDrawerMembersComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptTeamDrawerMembersComponent]
    });
    fixture = TestBed.createComponent(RptTeamDrawerMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
