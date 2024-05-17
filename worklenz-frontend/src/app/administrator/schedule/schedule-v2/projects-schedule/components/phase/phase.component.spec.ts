import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhaseComponent } from './phase.component';

describe('PhaseComponent', () => {
  let component: PhaseComponent;
  let fixture: ComponentFixture<PhaseComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PhaseComponent]
    });
    fixture = TestBed.createComponent(PhaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
