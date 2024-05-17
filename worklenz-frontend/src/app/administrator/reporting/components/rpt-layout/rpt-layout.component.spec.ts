import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptLayoutComponent} from './rpt-layout.component';

describe('RptLayoutComponent', () => {
  let component: RptLayoutComponent;
  let fixture: ComponentFixture<RptLayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptLayoutComponent]
    });
    fixture = TestBed.createComponent(RptLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
