import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ContactComponent } from './contact/contact.component';
import { RegisterComponent } from './register/register.component';
import { LoginComponent } from './login/login.component';
import { PasswordComponent } from './password/password.component';
import { ManageComponent } from './manage/manage.component';
import { FaqComponent } from './faq/faq.component';
import { TermsComponent } from './terms/terms.component';
import { CookiesComponent } from './cookies/cookies.component';
import { PrivacyComponent } from './privacy/privacy.component';
import { DisclaimerComponent } from './disclaimer/disclaimer.component';
import { StatsComponent } from './stats/stats.component';
import { InstrumentsComponent } from './instruments/instruments.component';
import { SnapshotComponent } from './snapshot/snapshot.component';
import { SnapshotsComponent } from './snapshots/snapshots.component';
import { SuggestionsComponent } from './suggestions/suggestions.component';
import { SuggestionComponent } from './suggestion/suggestion.component';
import { AdminComponent } from './admin/admin.component';
import { MonitorComponent } from './monitor/monitor.component';
import { WhitelistComponent } from './whitelist/whitelist.component';
import { AuthGuard, AdminAuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'faq', component: FaqComponent },
  { path: 'terms', component: TermsComponent },
  { path: 'cookies', component: CookiesComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'disclaimer', component: DisclaimerComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'password', component: PasswordComponent, canActivate: [AuthGuard] },
  { path: 'manage', component: ManageComponent, canActivate: [AuthGuard] },
  { path: 'stats', component: StatsComponent, canActivate: [AuthGuard] },
  { path: 'instruments', component: InstrumentsComponent, canActivate: [AuthGuard] },
  { path: 'snapshot', component: SnapshotComponent, canActivate: [AuthGuard] },
  { path: 'snapshots', component: SnapshotsComponent, canActivate: [AuthGuard] },
  { path: 'suggestions', component: SuggestionsComponent, canActivate: [AuthGuard] },
  { path: 'suggestion', component: SuggestionComponent, canActivate: [AuthGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [AdminAuthGuard] },
  { path: 'monitor', component: MonitorComponent, canActivate: [AdminAuthGuard] },
  { path: 'whitelist', component: WhitelistComponent, canActivate: [AdminAuthGuard] },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
