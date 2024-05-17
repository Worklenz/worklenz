import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NaComponent } from './na.component';

describe('NaComponent', () => {
  let component: NaComponent;
  let fixture: ComponentFixture<NaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NaComponent]
    });
    fixture = TestBed.createComponent(NaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
