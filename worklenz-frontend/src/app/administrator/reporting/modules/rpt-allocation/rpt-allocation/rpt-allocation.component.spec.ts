import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptAllocationComponent} from './rpt-allocation.component';

describe('RptAllocationComponent', () => {
  let component: RptAllocationComponent;
  let fixture: ComponentFixture<RptAllocationComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptAllocationComponent]
    });
    fixture = TestBed.createComponent(RptAllocationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
