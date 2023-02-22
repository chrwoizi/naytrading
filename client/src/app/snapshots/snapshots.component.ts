import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

import { SnapshotService } from '../services/snapshot.service';
import { Snapshot } from '../models/snapshot';
import { AlertService } from '../services/alert.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { ListBase } from '../helpers/ListBase';

@Component({
  selector: 'app-snapshots',
  templateUrl: './snapshots.component.html',
  styleUrls: ['./snapshots.component.scss'],
})
export class SnapshotsComponent extends ListBase<Snapshot> implements OnInit {
  constructor(
    route: ActivatedRoute,
    alertService: AlertService,
    private snapshotService: SnapshotService,
    spinner: NgxSpinnerService
  ) {
    super(route, alertService, spinner);
  }

  ngOnInit() {
    const self = this;

    self.orderProp = '-ModifiedDateSortable';

    super.parseQueryParam();

    let instrument: string | null = null;
    if (self.route.snapshot.queryParamMap.has('instrument')) {
      self.orderProp = '-DateSortable';
      instrument = self.route.snapshot.queryParamMap.get('instrument');
    }

    self.spinner.show();
    self.loading = true;
    self.snapshotService
      .list(instrument)
      .pipe(first())
      .subscribe(
        (data) => {
          self.loading = false;
          self.spinner.hide();
          if (data.error) {
            self.handleError(data.error);
          } else {
            self.setItems(data.snapshots);
          }
        },
        (error) => {
          self.spinner.hide();
          self.handleError(error);
        }
      );
  }

  filterItem(value, query): { value: boolean } {
    if (
      query == 'buy' ||
      query == 'wait' ||
      query == 'wait1yr' ||
      query == 'wait2mo' ||
      query == 'autowait' ||
      query == 'sell'
    ) {
      return { value: value.Decision == query };
    } else if (query == this.exactQuery) {
      return { value: value.Instrument.InstrumentName == query };
    } else {
      return {
        value:
          value.Instrument.InstrumentName.toLowerCase().indexOf(
            query.toLowerCase()
          ) != -1,
      };
    }
  }
}
