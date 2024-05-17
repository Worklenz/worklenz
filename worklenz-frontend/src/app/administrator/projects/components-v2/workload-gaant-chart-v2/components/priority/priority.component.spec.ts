import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WLPriorityComponent } from './priority.component';

describe('PriorityComponent', () => {
  let component: WLPriorityComponent;
  let fixture: ComponentFixture<WLPriorityComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [WLPriorityComponent]
    });
    fixture = TestBed.createComponent(WLPriorityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
