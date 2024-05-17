import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptHeaderComponent} from './rpt-header.component';

describe('RptHeaderComponent', () => {
  let component: RptHeaderComponent;
  let fixture: ComponentFixture<RptHeaderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptHeaderComponent]
    });
    fixture = TestBed.createComponent(RptHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
