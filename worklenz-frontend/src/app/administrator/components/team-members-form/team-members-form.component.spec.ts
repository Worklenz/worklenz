import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TeamMembersFormComponent} from './team-members-form.component';

describe('TeamMembersFormComponent', () => {
  let component: TeamMembersFormComponent;
  let fixture: ComponentFixture<TeamMembersFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamMembersFormComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TeamMembersFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
