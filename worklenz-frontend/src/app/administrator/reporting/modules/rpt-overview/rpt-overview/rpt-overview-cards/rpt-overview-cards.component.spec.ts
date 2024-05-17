import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptOverviewCardsComponent} from './rpt-overview-cards.component';

describe('RptOverviewCardsComponent', () => {
  let component: RptOverviewCardsComponent;
  let fixture: ComponentFixture<RptOverviewCardsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptOverviewCardsComponent]
    });
    fixture = TestBed.createComponent(RptOverviewCardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
