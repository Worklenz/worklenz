import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartDateComponent } from './start-date.component';

describe('StartDateComponent', () => {
  let component: StartDateComponent;
  let fixture: ComponentFixture<StartDateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StartDateComponent]
    });
    fixture = TestBed.createComponent(StartDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
