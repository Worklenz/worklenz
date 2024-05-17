import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptProjectsListComponent} from './rpt-projects-list.component';

describe('RptProjectsListComponent', () => {
  let component: RptProjectsListComponent;
  let fixture: ComponentFixture<RptProjectsListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptProjectsListComponent]
    });
    fixture = TestBed.createComponent(RptProjectsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
