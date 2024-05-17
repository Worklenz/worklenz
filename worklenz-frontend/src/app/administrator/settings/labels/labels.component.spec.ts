import {ComponentFixture, TestBed} from '@angular/core/testing';

import {LabelsComponent} from './labels.component';

describe('LabelsComponent', () => {
  let component: LabelsComponent;
  let fixture: ComponentFixture<LabelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LabelsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LabelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
