import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ToggleMenuButtonComponent} from './toggle-menu-button.component';

describe('ToggleMenuButtonComponent', () => {
  let component: ToggleMenuButtonComponent;
  let fixture: ComponentFixture<ToggleMenuButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ToggleMenuButtonComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ToggleMenuButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
