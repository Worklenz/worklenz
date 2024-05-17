import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptMemberDrawerOverviewComponent} from './rpt-member-drawer-overview.component';

describe('RptMemberDrawerOverviewComponent', () => {
  let component: RptMemberDrawerOverviewComponent;
  let fixture: ComponentFixture<RptMemberDrawerOverviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptMemberDrawerOverviewComponent]
    });
    fixture = TestBed.createComponent(RptMemberDrawerOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
