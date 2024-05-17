import {ComponentFixture, TestBed} from '@angular/core/testing';

import {PersonalOverviewComponent} from './personal-overview.component';

describe('PersonalOverviewComponent', () => {
  let component: PersonalOverviewComponent;
  let fixture: ComponentFixture<PersonalOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PersonalOverviewComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PersonalOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
