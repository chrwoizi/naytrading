import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AlertService } from '../services/alert.service';
import { AuthenticationService } from '../services/authentication.service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'app-whitelist',
    templateUrl: './whitelist.component.html',
    styleUrls: ['./whitelist.component.scss']
})
export class WhitelistComponent implements OnInit {
    addForm: FormGroup;
    loading = false;
    submitted = false;
    whitelists = [];

    constructor(
        private formBuilder: FormBuilder,
        private authenticationService: AuthenticationService,
        private alertService: AlertService,
        private spinner: NgxSpinnerService
    ) {
    }

    ngOnInit() {
        var self = this;
        self.addForm = self.formBuilder.group({
            username: ['', Validators.required]
        });
        self.reload();
    }

    // convenience getter for easy access to form fields
    get f() { return this.addForm.controls; }

    onSubmit() {
        var self = this;
        self.submitted = true;

        // stop here if form is invalid
        if (self.addForm.invalid) {
            return;
        }

        self.spinner.show();
        self.loading = true;
        self.authenticationService.addWhitelist(self.addForm.value.username)
            .pipe(first())
            .subscribe(
                data => {
                    self.spinner.hide();
                    self.loading = false;
                    if (data.error) {
                        self.alertService.error(data.error);
                    }
                    else {
                        self.alertService.success('User added', true);
                        self.reload();
                    }
                },
                error => {
                    self.spinner.hide();
                    self.loading = false;
                    self.alertService.error(error ? error.error : "");
                });
    }

    delete(username) {
        var self = this;
        self.spinner.show();
        self.loading = true;
        self.authenticationService.removeWhitelist(username)
            .pipe(first())
            .subscribe(
                data => {
                    self.spinner.hide();
                    self.loading = false;
                    if (data.error) {
                        self.alertService.error(data.error);
                    }
                    else {
                        self.alertService.success('User removed', true);
                        self.reload();
                    }
                },
                error => {
                    self.spinner.hide();
                    self.loading = false;
                    self.alertService.error(error ? error.error : "");
                });
    }

    reload() {
        var self = this;
        self.authenticationService.whitelist()
            .pipe(first())
            .subscribe(
                data => {
                    self.loading = false;
                    if (data.error) {
                        self.alertService.error(data.error);
                    }
                    else {
                        self.whitelists = data;
                    }
                },
                error => {
                    self.loading = false;
                    self.alertService.error(error ? error.error : "");
                });
    }
}