import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WLPhaseComponent } from './phase.component';

describe('PhaseComponent', () => {
  let component: WLPhaseComponent;
  let fixture: ComponentFixture<WLPhaseComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [WLPhaseComponent]
    });
    fixture = TestBed.createComponent(WLPhaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
