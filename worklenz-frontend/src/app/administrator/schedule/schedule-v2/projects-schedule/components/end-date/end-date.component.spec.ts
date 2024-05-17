import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EndDateComponent } from './end-date.component';

describe('EndDateComponent', () => {
  let component: EndDateComponent;
  let fixture: ComponentFixture<EndDateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EndDateComponent]
    });
    fixture = TestBed.createComponent(EndDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
