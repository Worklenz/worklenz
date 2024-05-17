import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptOverviewComponent} from './rpt-overview.component';

describe('RptOverviewComponent', () => {
  let component: RptOverviewComponent;
  let fixture: ComponentFixture<RptOverviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptOverviewComponent]
    });
    fixture = TestBed.createComponent(RptOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
