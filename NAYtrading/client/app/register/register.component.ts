import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AlertService } from '../services/alert.service';
import { AuthenticationService } from '../services/authentication.service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
    registerForm: FormGroup;
    loading = false;
    submitted = false;

    constructor(
        private formBuilder: FormBuilder,
        private router: Router,
        private authenticationService: AuthenticationService,
        private alertService: AlertService,
        private spinner: NgxSpinnerService
    ) {
        // redirect to home if already logged in
        if (this.authenticationService.currentUserValue) {
            this.router.navigate(['/']);
        }
    }

    ngOnInit() {
        this.registerForm = this.formBuilder.group({
            username: ['', Validators.required],
            password: ['', [Validators.required, Validators.minLength(8)]],
            confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
        });
    }

    // convenience getter for easy access to form fields
    get f() { return this.registerForm.controls; }

    onSubmit() {
        const self = this;
        self.submitted = true;

        // stop here if form is invalid
        if (self.registerForm.invalid) {
            return;
        }

        if (self.registerForm.value.password != self.registerForm.value.confirmPassword) {
            self.alertService.error("The password was not repeated correctly");
            return;
        }

        self.spinner.show();
        self.loading = true;
        self.authenticationService.register(self.registerForm.value.username, self.registerForm.value.password)
            .pipe(first())
            .subscribe(
                data => {
                    self.spinner.hide();
                    self.loading = false;
                    if (data.error) {
                        self.alertService.error(data.error);
                    }
                    else {
                        self.alertService.success('Registration successful', true);
                        self.router.navigate(['/']);
                    }
                },
                error => {
                    self.spinner.hide();
                    self.loading = false;
                    self.alertService.error(error);
                });
    }
}