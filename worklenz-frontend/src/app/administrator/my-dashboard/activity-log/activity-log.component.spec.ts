import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ActivityLogComponent} from './activity-log.component';

describe('ActivityLogComponent', () => {
  let component: ActivityLogComponent;
  let fixture: ComponentFixture<ActivityLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ActivityLogComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ActivityLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
