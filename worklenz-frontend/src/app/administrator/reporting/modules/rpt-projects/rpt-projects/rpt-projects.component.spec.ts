import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptProjectsComponent} from './rpt-projects.component';

describe('RptProjectsComponent', () => {
  let component: RptProjectsComponent;
  let fixture: ComponentFixture<RptProjectsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptProjectsComponent]
    });
    fixture = TestBed.createComponent(RptProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
