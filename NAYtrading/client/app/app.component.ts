import { Component, OnDestroy, OnInit } from '@angular/core';

import { AuthenticationService } from './services/authentication.service';
import { User } from './models/user';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'N.A.Y.trading';
  currentUser: User;
  subscription: Subscription;

  constructor(
    private authenticationService: AuthenticationService
  ) {
    const self = this;
    self.subscription = self.authenticationService.currentUser.subscribe(x => {
      self.currentUser = x;
    });
    self.authenticationService.check();
  }

  logout() {
    this.authenticationService.logout();
  }

  ngOnInit() {
    setTimeout(function () {
      $("a.nav-link").click(function () {
        ($('#navbarsDefault') as any).collapse('hide');
      });
    }, 1);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
