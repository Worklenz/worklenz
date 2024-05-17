import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptProjectDrawerOverviewComponent} from './rpt-project-drawer-overview.component';

describe('RptProjectDrawerOverviewComponent', () => {
  let component: RptProjectDrawerOverviewComponent;
  let fixture: ComponentFixture<RptProjectDrawerOverviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptProjectDrawerOverviewComponent]
    });
    fixture = TestBed.createComponent(RptProjectDrawerOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
