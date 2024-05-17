import {ComponentFixture, TestBed} from '@angular/core/testing';

import {NotificationsDrawerComponent} from './notifications-drawer.component';

describe('NotificationsDrawerComponent', () => {
  let component: NotificationsDrawerComponent;
  let fixture: ComponentFixture<NotificationsDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotificationsDrawerComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(NotificationsDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
