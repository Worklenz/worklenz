import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkloadGaantChartV2Component } from './workload-gaant-chart-v2.component';

describe('WorkloadGaantChartV2Component', () => {
  let component: WorkloadGaantChartV2Component;
  let fixture: ComponentFixture<WorkloadGaantChartV2Component>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [WorkloadGaantChartV2Component]
    });
    fixture = TestBed.createComponent(WorkloadGaantChartV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
