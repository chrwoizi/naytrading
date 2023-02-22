import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { User } from '../models/user';
import { TokenResponse } from '../models/token';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  constructor(private http: HttpClient) {
    const fromStorage = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      fromStorage ? JSON.parse(fromStorage) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  check() {
    this.http
      .get<User>('/api/user')
      .pipe(
        map((user) => {
          if (user && user.token) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.currentUserSubject.next(user);
          } else {
            localStorage.removeItem('currentUser');
            this.currentUserSubject.next(null);
          }

          return user;
        })
      )
      .subscribe(
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        (data) => {},
        (error) => {
          localStorage.removeItem('currentUser');
          this.currentUserSubject.next(null);
        }
      );
  }

  register(username: string, password: string) {
    return this.http
      .post<any>('/api/register', { email: username, password: password })
      .pipe(
        map((user) => {
          if (user && user.token) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.currentUserSubject.next(user);
          }

          return user;
        })
      );
  }

  login(username: string, password: string) {
    return this.http
      .post<any>('/api/login', { email: username, password: password })
      .pipe(
        map((user) => {
          if (user && user.token) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.currentUserSubject.next(user);
          }

          return user;
        })
      );
  }

  logout() {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  getAll() {
    return this.http.get<User[]>('/api/users');
  }

  password(user: User, form): any {
    return this.http.post('/api/password', {
      email: user.username,
      password: form.password,
      confirmPassword: form.confirmPassword,
      newPassword: form.newPassword,
    });
  }

  delete(username) {
    return this.http.post<any>('/api/deleteme', { email: username }).pipe(
      map((data) => {
        if (!(data && data.error)) {
          localStorage.removeItem('currentUser');
          this.currentUserSubject.next(null);
        }
        return data;
      })
    );
  }

  whitelist() {
    return this.http.get<any>('/api/whitelist');
  }

  addWhitelist(username) {
    return this.http.post<any>('/api/whitelist/add', { username: username });
  }

  removeWhitelist(username) {
    return this.http.post<any>('/api/whitelist/remove', { username: username });
  }

  createToken() {
    return this.http.get<TokenResponse>('/api/token');
  }
}
