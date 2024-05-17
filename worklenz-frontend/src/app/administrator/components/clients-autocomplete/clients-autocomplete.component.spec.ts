import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ClientsAutocompleteComponent} from './clients-autocomplete.component';

describe('ClientsAutocompleteComponent', () => {
  let component: ClientsAutocompleteComponent;
  let fixture: ComponentFixture<ClientsAutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClientsAutocompleteComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ClientsAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
