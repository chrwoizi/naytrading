import { Injectable } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AlertService {
    private subject = new Subject<any>();
    private keepAfterNavigationChange = false;
    private timeout: NodeJS.Timer;

    constructor(private router: Router) {
        // clear alert message on route change
        router.events.subscribe(event => {
            if (event instanceof NavigationStart) {
                if (this.keepAfterNavigationChange) {
                    // only keep for a single location change
                    this.keepAfterNavigationChange = false;
                } else {
                    // clear alert
                    this.subject.next();
                }
            }
        });
    }

    success(message: string, keepAfterNavigationChange = false) {
        this.keepAfterNavigationChange = keepAfterNavigationChange;
        this.subject.next({ type: 'success', text: message });
        
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.timeout = setTimeout(() => this.subject.next(), 10000);
    }

    getText(error: any): string {
        if (typeof (error) === 'string') {
            return error;
        }
        else if (error && error.message) {
            return error.message;
        }
        else if (error && error.data) {
            return error.data;
        }

        return "unknown error";
    }

    error(error: any, keepAfterNavigationChange = false) {
        const message = this.getText(error);
        this.keepAfterNavigationChange = keepAfterNavigationChange;
        this.subject.next({ type: 'error', text: message });

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.timeout = setTimeout(() => this.subject.next(), 10000);
    }

    getMessage(): Observable<any> {
        return this.subject.asObservable();
    }
}