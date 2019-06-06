import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';
import { User } from '../models/user';
import { Subscription } from 'rxjs';
import * as Chart from 'chart.js';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  currentUser: User;
  subscription: Subscription;

  constructor(
    private authenticationService: AuthenticationService
  ) {
    this.subscription = this.authenticationService.currentUser.subscribe(x => {
      this.currentUser = x;
    });
  }

  ngOnInit() {
    function formatDate(date) {
      var y = date.getYear() + 1900;
      var m = date.getMonth() + 1;
      var d = date.getDate();
      var mm = m < 10 ? '0' + m : m;
      var dd = d < 10 ? '0' + d : d;
      return '' + dd + '.' + mm + '.' + y;
    }

    var dates = [];
    var rates = [];
    var r1 = Math.random();
    var r2 = Math.random();
    var r3 = Math.random();
    for (var i = -365 * 5, j = 0; i <= 0; ++i, ++j) {
      var date = new Date(new Date().getTime() + i * 24 * 60 * 60 * 1000);
      dates.push(formatDate(date));
      var oct1 = 1.5 * Math.sin(i / 65 - 0.5 * Math.PI);
      var oct2 = 0.4 * Math.sin(i / 19 - r1 * Math.PI);
      var oct3 = 0.3 * Math.sin(i / 5 - r2 * Math.PI);
      var oct4 = 0.2 * Math.sin(i / 3 - r3 * Math.PI);
      var r = j / (365 * 5);
      var rate = 2 + 8 * Math.pow(r, 1.2) + 10 + oct1 + oct2 + oct3 + oct4;
      rates.push(Math.round(rate * 100) / 100);
    }

    var config: Chart.ChartConfiguration = {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          yAxisID: 'y-axis-2',
          backgroundColor: 'rgba(151,187,205,0.2)',
          borderColor: 'rgba(151,187,205,1)',
          data: rates,
        }]
      },
      options: {
        scales: {
          yAxes: [
            {
              id: 'y-axis-2',
              type: 'linear',
              display: true,
              position: 'right'
            }
          ],
          xAxes: [{
            ticks: {
              autoSkip: true,
              maxTicksLimit: 5,
              maxRotation: 0
            }
          }]
        },
        elements: {
          point: {
            radius: 0
          }
        },
        animation: null,
        maintainAspectRatio: false,
        legend: null
      }
    };

    setTimeout(function () {
      var ctx = (document.getElementById('canvas') as any).getContext('2d');
      new Chart(ctx, config);
    }, 1);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
