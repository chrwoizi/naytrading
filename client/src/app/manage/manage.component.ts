import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { first } from 'rxjs/operators';

import { NgxSpinnerService } from 'ngx-spinner';
import { Subscription } from 'rxjs';
import { Processings } from '../models/processings';
import { User } from '../models/user';
import { AlertService } from '../services/alert.service';
import { AuthenticationService } from '../services/authentication.service';
import { ManageService } from '../services/manage.service';

@Component({
  selector: 'app-manage',
  templateUrl: './manage.component.html',
  styleUrls: ['./manage.component.scss'],
})
export class ManageComponent implements OnInit, OnDestroy {
  currentUserSubscription!: Subscription;
  currentUser: User | null = null;

  public isAdmin?: boolean;
  public isAi?: boolean;
  public token!: string;

  public processings!: Processings;
  public deleteUser!: string;

  loading = false;

  constructor(
    private router: Router,
    private alertService: AlertService,
    private authenticationService: AuthenticationService,
    private manageService: ManageService,
    private spinner: NgxSpinnerService
  ) {
    const self = this;
    self.currentUserSubscription =
      self.authenticationService.currentUser.subscribe((user) => {
        self.currentUser = user;
      });
  }

  ngOnInit() {
    const self = this;

    const currentUser = self.authenticationService.currentUserValue;
    self.isAdmin = currentUser?.isAdmin;
    self.isAi = currentUser?.username.endsWith('.ai');

    self.spinner.show();
    self.loading = true;
    self.authenticationService
      .createToken()
      .pipe(first())
      .subscribe(
        (response) => {
          self.token = response.token;
          self.manageService
            .getProcessings()
            .pipe(first())
            .subscribe(
              (response) => {
                self.loading = false;
                self.spinner.hide();
                self.processings = response.processings;
              },
              (error) => {
                self.spinner.hide();
                self.alertService.error(error);
              }
            );
        },
        (error) => {
          self.spinner.hide();
          self.alertService.error(error);
        }
      );
  }

  ngOnDestroy() {
    this.currentUserSubscription.unsubscribe();
  }

  onDeleteUser() {
    const self = this;

    self.spinner.show();
    self.authenticationService
      .delete(self.deleteUser)
      .pipe(first())
      .subscribe(
        (data) => {
          self.spinner.hide();
          if (data.error) {
            self.alertService.error(data.error);
          } else {
            self.alertService.success('User was deleted', true);
            self.router.navigate(['/']);
          }
        },
        (error) => {
          self.spinner.hide();
          self.alertService.error(error);
        }
      );
  }

  onClearDecisions() {
    const self = this;

    self.spinner.show();
    self.manageService
      .clearDecisions()
      .pipe(first())
      .subscribe(
        (data) => {
          self.spinner.hide();
          if (data.error) {
            self.alertService.error(data.error);
          } else {
            self.alertService.success('Decisions were cleared', true);
          }
        },
        (error) => {
          self.spinner.hide();
          self.alertService.error(error);
        }
      );
  }
}
