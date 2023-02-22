import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

import { SuggestionService } from '../services/suggestion.service';
import { SuggestionViewModel } from '../models/suggestion';
import { AlertService } from '../services/alert.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { ListBase } from '../helpers/ListBase';

@Component({
  selector: 'app-suggestions',
  templateUrl: './suggestions.component.html',
  styleUrls: ['./suggestions.component.scss'],
})
export class SuggestionsComponent
  extends ListBase<SuggestionViewModel>
  implements OnInit
{
  constructor(
    route: ActivatedRoute,
    alertService: AlertService,
    private suggestionService: SuggestionService,
    spinner: NgxSpinnerService
  ) {
    super(route, alertService, spinner);
  }

  ngOnInit() {
    const self = this;

    self.orderProp = '-TS';

    super.parseQueryParam();

    self.spinner.show();
    self.loading = true;
    self.suggestionService
      .list()
      .pipe(first())
      .subscribe(
        (data) => {
          self.loading = false;
          self.spinner.hide();
          if (data.error) {
            self.handleError(data.error);
          } else {
            self.setItems(data.suggestions);
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
      query == 'i' ||
      query == 'p' ||
      query == 't' ||
      query == 'f' ||
      query == 'c'
    ) {
      return { value: value.S == query };
    } else if (query == this.exactQuery) {
      return { value: value.I == query };
    } else {
      return {
        value: value.I.toLowerCase().indexOf(query.toLowerCase()) != -1,
      };
    }
  }

  getId(item) {
    return item.I;
  }

  formatCurrency(n) {
    if (typeof n === 'undefined') return undefined;
    const abbrv = ['', 'T', 'M'];
    let i;
    for (i = 0; i < abbrv.length - 1 && Math.abs(n) >= 1000; ++i) {
      n /= 1000.0;
    }
    return n.toFixed(2) + abbrv[i];
  }

  getStatusIcon(status) {
    switch (status) {
      case 'i':
        return 'glyphicon-asterisk';
      case 't':
        return 'glyphicon-repeat';
      case 'f':
        return 'glyphicon-remove';
      case 'p':
        return 'glyphicon-time';
      case 'c':
        return 'glyphicon-ok';
      default:
        return 'glyphicon-question-sign';
    }
  }

  getActionIcon(action) {
    switch (action) {
      case 'buy':
        return 'glyphicon-log-in';
      case 'sell':
        return 'glyphicon-log-out';
      default:
        return 'glyphicon-question-sign';
    }
  }
}
