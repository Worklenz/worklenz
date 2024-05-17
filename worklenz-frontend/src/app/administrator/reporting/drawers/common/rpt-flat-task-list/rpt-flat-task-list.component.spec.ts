import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptFlatTaskListComponent} from './rpt-flat-task-list.component';

describe('RptFlatTaskListComponent', () => {
  let component: RptFlatTaskListComponent;
  let fixture: ComponentFixture<RptFlatTaskListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptFlatTaskListComponent]
    });
    fixture = TestBed.createComponent(RptFlatTaskListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
