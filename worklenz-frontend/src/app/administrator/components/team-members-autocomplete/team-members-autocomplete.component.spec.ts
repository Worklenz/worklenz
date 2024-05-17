import {ComponentFixture, TestBed} from '@angular/core/testing';

import {TeamMembersAutocompleteComponent} from './team-members-autocomplete.component';

describe('TeamMembersAutocompleteComponent', () => {
  let component: TeamMembersAutocompleteComponent;
  let fixture: ComponentFixture<TeamMembersAutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamMembersAutocompleteComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TeamMembersAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
