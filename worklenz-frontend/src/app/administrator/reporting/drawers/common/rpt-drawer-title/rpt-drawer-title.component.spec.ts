import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptDrawerTitleComponent} from './rpt-drawer-title.component';

describe('RptDrawerTitleComponent', () => {
  let component: RptDrawerTitleComponent;
  let fixture: ComponentFixture<RptDrawerTitleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RptDrawerTitleComponent]
    });
    fixture = TestBed.createComponent(RptDrawerTitleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
