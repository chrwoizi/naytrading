import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

import { User } from '../models/user';
import { AuthenticationService } from '../services/authentication.service';
import { AdminService } from '../services/admin.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { AlertService } from '../services/alert.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, OnDestroy {

  currentUser: User;
  currentUserSubscription: Subscription;
  users: User[] = [];
  markets: string[] = [];
  sources: string[] = [];
  loading: boolean;
  token: string;
  refreshId: number;
  refreshSource: string;
  refreshMarket: string;
  addInstrumentUrl: string;

  constructor(
    private authenticationService: AuthenticationService,
    private adminService: AdminService,
    private alertService: AlertService,
    private spinner: NgxSpinnerService
  ) {
    var self = this;

    self.currentUserSubscription = self.authenticationService.currentUser.subscribe(user => {
      self.currentUser = user;
    });
  }

  ngOnInit() {
    var self = this;

    self.spinner.show();
    self.loading = true;
    self.authenticationService.getAll().pipe(first()).subscribe(users => {
      self.users = users;

      self.authenticationService.createToken().pipe(first()).subscribe(response => {
        self.token = response.token;

        self.adminService.getProviders().pipe(first()).subscribe(providers => {
          self.spinner.hide();
          self.loading = false;

          self.markets = providers.markets;
          self.sources = providers.sources;
        },
          error => {
            self.spinner.hide();
            self.alertService.error(error);
          });
      },
        error => {
          self.spinner.hide();
          self.alertService.error(error);
        });
    },
      error => {
        self.spinner.hide();
        self.alertService.error(error);
      });
  }

  ngOnDestroy() {
    this.currentUserSubscription.unsubscribe();
  }

  reloadConfig() {
    var self = this;
    self.spinner.show();
    self.adminService.reloadConfig().pipe(first()).subscribe(
      data => {
        self.spinner.hide();
        if (data.error) {
          self.alertService.error(data.error);
        }
        else {
          self.alertService.success(JSON.stringify(data), true);
        }
      },
      error => {
        self.spinner.hide();
        self.alertService.error(error);
      });
  }

  clearStats() {
    var self = this;
    self.spinner.show();
    self.adminService.clearStats().pipe(first()).subscribe(
      data => {
        self.spinner.hide();
        if (data.error) {
          self.alertService.error(data.error);
        }
        else {
          self.alertService.success(JSON.stringify(data), true);
        }
      },
      error => {
        self.spinner.hide();
        self.alertService.error(error);
      });
  }

  refreshRates() {
    var self = this;
    self.spinner.show();
    self.adminService.refreshRates(self.refreshId, self.refreshSource, self.refreshMarket).pipe(first()).subscribe(
      data => {
        self.spinner.hide();
        if (data.error) {
          self.alertService.error(data.error);
        }
        else {
          self.alertService.success(JSON.stringify(data), true);
        }
      },
      error => {
        self.spinner.hide();
        self.alertService.error(error);
      });
  }

  addInstrument() {
    var self = this;
    self.spinner.show();
    self.adminService.addInstrument(self.addInstrumentUrl).pipe(first()).subscribe(
      data => {
        self.spinner.hide();
        if (data.error) {
          self.alertService.error(data.error);
        }
        else {
          self.alertService.success(JSON.stringify(data), true);
        }
      },
      error => {
        self.spinner.hide();
        self.alertService.error(error);
      });
  }

  updateInstruments() {
    var self = this;
    self.spinner.show();
    self.adminService.updateInstruments().pipe(first()).subscribe(
      data => {
        self.spinner.hide();
        if (data.error) {
          self.alertService.error(data.error);
        }
        else {
          self.alertService.success(JSON.stringify(data), true);
        }
      },
      error => {
        self.spinner.hide();
        self.alertService.error(error);
      });
  }

}
