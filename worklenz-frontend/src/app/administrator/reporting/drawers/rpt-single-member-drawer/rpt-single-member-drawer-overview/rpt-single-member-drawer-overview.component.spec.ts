import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RptSingleMemberDrawerOverviewComponent } from './rpt-single-member-drawer-overview.component';

describe('RptSingleMemberDrawerOverviewComponent', () => {
  let component: RptSingleMemberDrawerOverviewComponent;
  let fixture: ComponentFixture<RptSingleMemberDrawerOverviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptSingleMemberDrawerOverviewComponent]
    });
    fixture = TestBed.createComponent(RptSingleMemberDrawerOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
