import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {IClient} from "@interfaces/client";
import {ClientsApiService} from "@api/clients-api.service";
import {log_error} from "@shared/utils";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzAutocompleteModule} from "ng-zorro-antd/auto-complete";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NgForOf, NgIf} from "@angular/common";
import {NzInputModule} from "ng-zorro-antd/input";

@Component({
  selector: 'worklenz-clients-autocomplete',
  templateUrl: './clients-autocomplete.component.html',
  styleUrls: ['./clients-autocomplete.component.scss'],
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzAutocompleteModule,
    NzIconModule,
    NgIf,
    NgForOf,
    NzInputModule
  ],
  standalone: true
})
export class ClientsAutocompleteComponent implements OnInit {
  @Output() nameChange: EventEmitter<string> = new EventEmitter<string>();
  @Input() name: string | null = null;

  form!: FormGroup;

  searching = false;
  isNew = false;

  newName: string | null = null;

  clients: IClient[] = [];

  total = 0;

  constructor(
    private api: ClientsApiService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      name: []
    });
  }

  async ngOnInit() {
    this.form.controls["name"].setValue(this.name || null);
    this.form.get('name')?.valueChanges.subscribe((value) => {
      if (value) {
        this.newName = value;
        this.isNew = !this.clients.some((i) => i.name === value);
        return;
      }

      this.isNew = false;
    });
    await this.get();
  }

  async get() {
    try {
      const res = await this.api.get(1, 5, null, null, this.form.value.name || null);
      if (res.done) {
        this.clients = res.body.data || [];
        this.total = this.clients.length;
      }
    } catch (e) {
      log_error(e);
    }
  }

  async search() {
    this.emitChange();
    this.searching = true;
    await this.get();
    this.searching = false;
  }

  private emitChange() {
    if (this.form.valid)
      this.nameChange.emit(this.form.value.name.trim());
  }
}
