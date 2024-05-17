import {ComponentFixture, TestBed} from '@angular/core/testing';

import {AvatarsComponent} from './avatars.component';

describe('AvatarsComponent', () => {
  let component: AvatarsComponent;
  let fixture: ComponentFixture<AvatarsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AvatarsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(AvatarsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
