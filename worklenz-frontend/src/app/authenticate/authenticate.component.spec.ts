import {ComponentFixture, TestBed} from '@angular/core/testing';

import {AuthenticateComponent} from './authenticate.component';

describe('AuthenticateComponent', () => {
  let component: AuthenticateComponent;
  let fixture: ComponentFixture<AuthenticateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AuthenticateComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AuthenticateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
