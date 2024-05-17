import {ComponentFixture, TestBed} from '@angular/core/testing';

import {MemberStatsComponent} from './member-stats.component';

describe('MemberStatsComponent', () => {
  let component: MemberStatsComponent;
  let fixture: ComponentFixture<MemberStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MemberStatsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MemberStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
