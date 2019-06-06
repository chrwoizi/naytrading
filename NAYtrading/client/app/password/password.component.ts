import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AlertService } from '../services/alert.service';
import { AuthenticationService } from '../services/authentication.service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-password',
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.scss']
})
export class PasswordComponent implements OnInit {
  passwordForm: FormGroup;
  loading = false;
  submitted = false;

  constructor(
    private formBuilder: FormBuilder,
    private alertService: AlertService,
    private authenticationService: AuthenticationService,
    private spinner: NgxSpinnerService
  ) {
  }

  ngOnInit() {
    this.passwordForm = this.formBuilder.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  // convenience getter for easy access to form fields
  get f() { return this.passwordForm.controls; }

  onSubmit() {
    var self = this;
    self.submitted = true;

    // stop here if form is invalid
    if (self.passwordForm.invalid) {
      return;
    }

    self.spinner.show();
    self.loading = true;
    self.authenticationService.password(self.authenticationService.currentUserValue, self.passwordForm.value)
      .pipe(first())
      .subscribe(
        data => {
          self.spinner.hide();
          self.loading = false;
          if (data.error) {
            self.alertService.error(data.error);
          }
          else {
            self.alertService.success('Password changed', true);
            self.passwordForm.reset();
          }
        },
        error => {
          self.spinner.hide();
          self.loading = false;
          self.alertService.error(error ? error.error : "");
        });
  }
}