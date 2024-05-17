import {ComponentFixture, TestBed} from '@angular/core/testing';

import {VerifyResetEmailComponent} from './verify-reset-email.component';

describe('VerifyResetEmailComponent', () => {
  let component: VerifyResetEmailComponent;
  let fixture: ComponentFixture<VerifyResetEmailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VerifyResetEmailComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(VerifyResetEmailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
