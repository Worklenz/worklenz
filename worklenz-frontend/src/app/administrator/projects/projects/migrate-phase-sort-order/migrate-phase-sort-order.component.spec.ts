import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MigratePhaseSortOrderComponent } from './migrate-phase-sort-order.component';

describe('MigratePhaseSortOrderComponent', () => {
  let component: MigratePhaseSortOrderComponent;
  let fixture: ComponentFixture<MigratePhaseSortOrderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MigratePhaseSortOrderComponent]
    });
    fixture = TestBed.createComponent(MigratePhaseSortOrderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
