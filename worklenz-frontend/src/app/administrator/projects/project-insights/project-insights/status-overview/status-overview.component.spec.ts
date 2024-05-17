import {ComponentFixture, TestBed} from '@angular/core/testing';

import {StatusOverviewComponent} from './status-overview.component';

describe('StatusOverviewComponent', () => {
  let component: StatusOverviewComponent;
  let fixture: ComponentFixture<StatusOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatusOverviewComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(StatusOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
