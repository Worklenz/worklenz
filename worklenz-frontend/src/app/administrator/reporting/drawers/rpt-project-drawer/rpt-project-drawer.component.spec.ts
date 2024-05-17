import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptProjectDrawerComponent} from './rpt-project-drawer.component';

describe('RptProjectDrawerComponent', () => {
  let component: RptProjectDrawerComponent;
  let fixture: ComponentFixture<RptProjectDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptProjectDrawerComponent]
    });
    fixture = TestBed.createComponent(RptProjectDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
