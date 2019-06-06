import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { ContactComponent } from './contact/contact.component';
import { RegisterComponent } from './register/register.component';
import { LoginComponent } from './login/login.component';
import { PasswordComponent } from './password/password.component';
import { ManageComponent } from './manage/manage.component';
import { FaqComponent } from './faq/faq.component';
import { TermsComponent } from './terms/terms.component';
import { CookiesComponent } from './cookies/cookies.component';
import { DisclaimerComponent } from './disclaimer/disclaimer.component';
import { PrivacyComponent } from './privacy/privacy.component';
import { StatsComponent } from './stats/stats.component';
import { InstrumentsComponent } from './instruments/instruments.component';
import { SnapshotComponent } from './snapshot/snapshot.component';
import { SnapshotsComponent } from './snapshots/snapshots.component';
import { SuggestionsComponent } from './suggestions/suggestions.component';
import { SuggestionComponent } from './suggestion/suggestion.component';
import { AdminComponent } from './admin/admin.component';
import { MonitorComponent } from './monitor/monitor.component';
import { WhitelistComponent } from './whitelist/whitelist.component';

import { AlertComponent } from './alert/alert.component';
import { JwtInterceptor } from './helpers/jwt.interceptor';
import { ErrorInterceptor } from './helpers/error.interceptor';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxSpinnerModule } from 'ngx-spinner';
import { ChartsModule } from 'ng2-charts';

@NgModule({
  declarations: [
    AppComponent,
    AlertComponent,
    HomeComponent,
    ContactComponent,
    RegisterComponent,
    LoginComponent,
    PasswordComponent,
    ManageComponent,
    FaqComponent,
    TermsComponent,
    CookiesComponent,
    DisclaimerComponent,
    PrivacyComponent,
    StatsComponent,
    InstrumentsComponent,
    SnapshotComponent,
    SnapshotsComponent,
    SuggestionsComponent,
    SuggestionComponent,
    AdminComponent,
    MonitorComponent,
    WhitelistComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppRoutingModule,
    InfiniteScrollModule,
    NgxSpinnerModule,
    ChartsModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
