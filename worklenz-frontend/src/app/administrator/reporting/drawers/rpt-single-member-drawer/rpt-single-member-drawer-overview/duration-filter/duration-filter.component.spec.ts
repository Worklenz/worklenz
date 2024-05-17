import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DurationFilterComponent } from './duration-filter.component';

describe('DurationFilterComponent', () => {
  let component: DurationFilterComponent;
  let fixture: ComponentFixture<DurationFilterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DurationFilterComponent]
    });
    fixture = TestBed.createComponent(DurationFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
