import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptTeamDrawerComponent} from './rpt-team-drawer.component';

describe('RptTeamDrawerComponent', () => {
  let component: RptTeamDrawerComponent;
  let fixture: ComponentFixture<RptTeamDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptTeamDrawerComponent]
    });
    fixture = TestBed.createComponent(RptTeamDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
