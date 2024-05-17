import {ComponentFixture, TestBed} from '@angular/core/testing';

import {AccountSetupComponent} from './account-setup.component';

describe('AccountSetupComponent', () => {
  let component: AccountSetupComponent;
  let fixture: ComponentFixture<AccountSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AccountSetupComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(AccountSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
