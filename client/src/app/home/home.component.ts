import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';
import { User } from '../models/user';
import { Subscription } from 'rxjs';
import { Chart, ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  subscription: Subscription;

  constructor(private authenticationService: AuthenticationService) {
    this.subscription = this.authenticationService.currentUser.subscribe(
      (x) => {
        this.currentUser = x;
      }
    );
  }

  ngOnInit() {
    function formatDate(date) {
      const y = date.getYear() + 1900;
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const mm = m < 10 ? '0' + m : m;
      const dd = d < 10 ? '0' + d : d;
      return '' + dd + '.' + mm + '.' + y;
    }

    const dates: string[] = [];
    const rates: number[] = [];
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    for (let i = -365 * 5, j = 0; i <= 0; ++i, ++j) {
      const date = new Date(new Date().getTime() + i * 24 * 60 * 60 * 1000);
      dates.push(formatDate(date));
      const oct1 = 1.5 * Math.sin(i / 65 - 0.5 * Math.PI);
      const oct2 = 0.4 * Math.sin(i / 19 - r1 * Math.PI);
      const oct3 = 0.3 * Math.sin(i / 5 - r2 * Math.PI);
      const oct4 = 0.2 * Math.sin(i / 3 - r3 * Math.PI);
      const r = j / (365 * 5);
      const rate = 2 + 8 * Math.pow(r, 1.2) + 10 + oct1 + oct2 + oct3 + oct4;
      rates.push(Math.round(rate * 100) / 100);
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            yAxisID: 'y-axis-2',
            backgroundColor: 'rgba(151,187,205,0.2)',
            borderColor: 'rgba(151,187,205,1)',
            data: rates,
          },
        ],
      },
      options: {
        scales: {
          'y-axis-2': {
            type: 'linear',
            display: true,
            position: 'right',
          },
          'x-axis': {
            position: 'bottom',
            ticks: {
              autoSkip: true,
              maxTicksLimit: 5,
              maxRotation: 0,
            },
          },
        },
        elements: {
          point: {
            radius: 0,
          },
        },
        animation: false,
        maintainAspectRatio: false,
      },
    };

    setTimeout(function () {
      const ctx = (document.getElementById('canvas') as any).getContext('2d');
      new Chart(ctx, config);
    }, 1);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
