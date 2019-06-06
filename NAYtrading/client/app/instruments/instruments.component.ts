import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

import { InstrumentService } from '../services/instrument.service';
import { Instrument } from '../models/instrument';
import { AlertService } from '../services/alert.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { ListBase } from '../helpers/ListBase';

@Component({
  selector: 'app-instruments',
  templateUrl: './instruments.component.html',
  styleUrls: ['./instruments.component.scss']
})
export class InstrumentsComponent extends ListBase<Instrument> implements OnInit {
  constructor(
    route: ActivatedRoute,
    alertService: AlertService,
    private instrumentService: InstrumentService,
    spinner: NgxSpinnerService
  ) {
    super(route, alertService, spinner);
  }

  ngOnInit() {

    var self = this;

    self.orderProp = "-Capitalization";

    self.parseQueryParam();

    self.spinner.show();
    self.loading = true;
    self.instrumentService.list()
      .pipe(first())
      .subscribe(
        data => {
          self.loading = false;
          self.spinner.hide();
          if (data.error) {
            self.handleError(data.error);
          }
          else {
            self.setItems(data.instruments);
          }
        },
        error => {
          self.spinner.hide();
          self.handleError(error);
        });
  }

  filterItem(value, query): { value: boolean } {
    if (query == this.exactQuery) {
      return { value: value.InstrumentName == query };
    }
    else {
      return { value: value.InstrumentName.toLowerCase().indexOf(query.toLowerCase()) != -1 };
    }
  }
}