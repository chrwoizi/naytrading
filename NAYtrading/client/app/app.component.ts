import { Component, OnDestroy } from '@angular/core';

import { AuthenticationService } from './services/authentication.service';
import { User } from './models/user';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
  title = 'N.A.Y.trading';
  currentUser: User;
  subscription: Subscription;

  constructor(
    private authenticationService: AuthenticationService
  ) {
    var self = this;
    self.subscription = self.authenticationService.currentUser.subscribe(x => {
      self.currentUser = x;
    });
    self.authenticationService.check();
  }

  logout() {
    this.authenticationService.logout();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
