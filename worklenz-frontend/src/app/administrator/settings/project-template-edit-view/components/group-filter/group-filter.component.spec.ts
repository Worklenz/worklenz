import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupFilterComponent } from './group-filter.component';

describe('GroupFilterComponent', () => {
  let component: GroupFilterComponent;
  let fixture: ComponentFixture<GroupFilterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GroupFilterComponent]
    });
    fixture = TestBed.createComponent(GroupFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
