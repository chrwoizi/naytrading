import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService } from '../services/alert.service';
import { SuggestionService } from '../services/suggestion.service';
import { ActivatedRoute } from '@angular/router';
import { Suggestion, SuggestionLog } from '../models/suggestion';
import { NgxSpinnerService } from 'ngx-spinner';
import { ListBase } from '../helpers/ListBase';

@Component({
    selector: 'app-suggestion',
    templateUrl: './suggestion.component.html',
    styleUrls: ['./suggestion.component.scss']
})
export class SuggestionComponent extends ListBase<SuggestionLog> implements OnInit {
    loading = false;
    suggestion: Suggestion;

    constructor(
        route: ActivatedRoute,
        private suggestionService: SuggestionService,
        alertService: AlertService,
        spinner: NgxSpinnerService
    ) {
        super(route, alertService, spinner);
    }

    ngOnInit() {
        var self = this;

        self.loading = true;
        self.spinner.show();
        self.suggestionService.get(self.route.snapshot.queryParamMap.get('id'))
            .pipe(first())
            .subscribe(
                data => {
                    self.spinner.hide();
                    if (data.error) {
                        self.alertService.error(data.error);
                    }
                    else {
                        self.loading = false;
                        self.suggestion = data.suggestion;
                        self.setItems(self.suggestion.logs);
                    }
                },
                error => {
                    self.spinner.hide();
                    self.alertService.error(error);
                });
    }

    formatCurrency(n) {
        if (typeof (n) === 'undefined')
            return undefined;
        var abbrv = ["", "T", "M"];
        for (var i = 0; i < abbrv.length - 1 && Math.abs(n) >= 1000; ++i) {
            n /= 1000.0;
        }
        return n.toFixed(2) + abbrv[i];
    }

    toggleShowMessage(log) {
        log.showMessage = !log.showMessage;
    }
}