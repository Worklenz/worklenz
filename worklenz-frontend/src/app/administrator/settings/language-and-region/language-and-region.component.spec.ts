import {ComponentFixture, TestBed} from '@angular/core/testing';

import {LanguageAndRegionComponent} from './language-and-region.component';

describe('LanguageAndRegionComponent', () => {
  let component: LanguageAndRegionComponent;
  let fixture: ComponentFixture<LanguageAndRegionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LanguageAndRegionComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LanguageAndRegionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
