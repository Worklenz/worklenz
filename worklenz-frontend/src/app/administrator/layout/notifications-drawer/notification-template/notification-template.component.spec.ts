import {ComponentFixture, TestBed} from '@angular/core/testing';

import {NotificationTemplateComponent} from './notification-template.component';

describe('NotificationTemplateComponent', () => {
  let component: NotificationTemplateComponent;
  let fixture: ComponentFixture<NotificationTemplateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NotificationTemplateComponent]
    });
    fixture = TestBed.createComponent(NotificationTemplateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
