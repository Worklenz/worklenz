import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstimatedVsActualChartComponent } from './estimated-vs-actual-chart.component';

describe('EstimatedVsActualChartComponent', () => {
  let component: EstimatedVsActualChartComponent;
  let fixture: ComponentFixture<EstimatedVsActualChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EstimatedVsActualChartComponent]
    });
    fixture = TestBed.createComponent(EstimatedVsActualChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
