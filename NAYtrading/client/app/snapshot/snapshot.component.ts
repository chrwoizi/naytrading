import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { Color, Label } from 'ng2-charts';

import { AlertService } from '../services/alert.service';
import { ChartOptions, ChartDataSets } from 'chart.js';
import { SnapshotService } from '../services/snapshot.service';
import { ActivatedRoute, Router } from '@angular/router';
import { GetSnapshotResponse, Snapshot } from '../models/snapshot';
import { Observable } from 'rxjs';
import { Location } from '@angular/common';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-snapshot',
  templateUrl: './snapshot.component.html',
  styleUrls: ['./snapshot.component.scss']
})
export class SnapshotComponent implements OnInit {
  loading = false;

  public lineChart1Data: ChartDataSets[] = [];
  public lineChart1Labels: Label[] = [];

  public lineChart5Data: ChartDataSets[] = [];
  public lineChart5Labels: Label[] = [];

  public lineChartOptions: ChartOptions = {
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
          maxRotation: 0 // angle in degrees
        }
      }]
    },
    elements: {
      point: {
        radius: 0
      }
    },
    responsive: true,
    animation: null
  };

  public lineChartColors: Color[] = [{}];
  public lineChartLegend = false;
  public lineChartType = 'line';
  public lineChartPlugins = [];

  snapshot: Snapshot;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private alertService: AlertService,
    private snapshotService: SnapshotService,
    private spinner: NgxSpinnerService
  ) {
  }

  handleError(error) {
    if (error && error.data && error.data.error == 'unauthorized') {
      this.location.go('/login');
      return;
    }

    let message = "unknown error";
    if (typeof (error) === 'string') {
      message = error;
    }
    else if (error && error.message) {
      message = error.message;
    }
    else if (error && error.data) {
      message = error.data;
    }

    this.alertService.error(message);
  }

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      this.load();
    });
  }

  load() {
    const self = this;
    const currentLocation = window.location.href;

    let service: () => Observable<GetSnapshotResponse>;
    if (self.route.snapshot.queryParamMap.has('instrument')) {
      service = () => self.snapshotService.create(self.route.snapshot.queryParamMap.get('instrument'));
    } else if (self.route.snapshot.queryParamMap.has('action')) {
      service = () => self.snapshotService.create(self.route.snapshot.queryParamMap.get('action'));
    } else if (self.route.snapshot.queryParamMap.has('decision')) {
      service = () => self.snapshotService.confirm(self.route.snapshot.queryParamMap.get('id'), self.route.snapshot.queryParamMap.get('decision'), self.route.snapshot.queryParamMap.get('confirmed'));
    } else {
      service = () => self.snapshotService.get(self.route.snapshot.queryParamMap.get('id'));
    }

    self.spinner.show();
    self.loading = true;
    service().pipe(first()).subscribe(response => {
      self.loading = false;
      self.spinner.hide();

      if (currentLocation == window.location.href) {
        if (response.error) {
          self.handleError(response.error);
        }
        else {
          const snapshot = response.snapshot;
          if (snapshot.ConfirmDecision && snapshot.ConfirmDecision > 0) {
            self.router.navigate(
              [],
              {
                queryParams: {
                  id: snapshot.ID,
                  decision: snapshot.ConfirmDecision,
                  confirmed: snapshot.Confirmed
                },
                replaceUrl: true
              });
          }
          else {
            self.router.navigate(
              [],
              {
                queryParams: {
                  id: snapshot.ID
                },
                replaceUrl: true
              });
          }

          self.setRates(snapshot);
        }
      }
    },
      error => {
        self.spinner.hide();
        self.handleError(error);
      });
  }

  setRates(snapshot) {

    const self = this;

    self.snapshot = snapshot;

    if (snapshot.PreviousTime == null) {
      self.lineChartColors = [
        {
          backgroundColor: 'rgba(151,187,205,0.2)',
          borderColor: 'rgb(151,187,205)'
        }
      ];
    }
    else {
      self.lineChartColors = [
        {
          backgroundColor: 'rgba(151,187,205,0.2)',
          borderColor: 'rgb(151,187,205)'
        },
        {
          backgroundColor: 'rgba(255,0,0,0.2)',
          borderColor: 'red'
        },
        {
          backgroundColor: 'rgba(0,255,0,0.2)',
          borderColor: 'green'
        },
        {
          backgroundColor: 'rgba(255,128,0,0.2)',
          borderColor: 'orange'
        },
        {
          backgroundColor: 'rgba(151,187,205,0.2)',
          borderColor: 'transparent'
        }
      ];
    }

    function yymmdd(date) {
      const y = date.getYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const mm = m < 10 ? '0' + m : m;
      const dd = d < 10 ? '0' + d : d;
      return '' + (y % 100) + mm + dd;
    }

    function parseDate(dateString) {
      return new Date(
        (+("20" + dateString.substr(6, 2))),
        (+dateString.substr(3, 2)) - 1,
        (+dateString.substr(0, 2)),
        0,
        0,
        0
      );
    }

    function GetData(rates): ChartDataSets[] {

      if (snapshot.PreviousTime == null) {
        return [
          {
            label: "snapshot",
            yAxisID: 'y-axis-2',
            data: rates.map(function (v, i) {
              return v.C;
            })
          }
        ];
      } else {
        let previousSnapshotIndex = rates.length - 1;
        for (let i = 0; i < rates.length; i++) {
          if (rates[i].T >= snapshot.PreviousTime) {
            previousSnapshotIndex = i;
            break;
          }
        }

        return [
          {
            label: "snapshot",
            yAxisID: 'y-axis-2',
            data: rates.map(function (v, i) {
              if (i <= previousSnapshotIndex)
                return v.C;
              return null;
            })
          },
          {
            label: "loss",
            fill: '+3',
            yAxisID: 'y-axis-2',
            data: rates.map(function (v, i) {
              if (i >= previousSnapshotIndex && v.C <= snapshot.PreviousBuyRate)
                return v.C;
              return null;
            })
          },
          {
            label: "gain",
            fill: '+2',
            yAxisID: 'y-axis-2',
            data:
              rates.map(function (v, i) {
                if (i >= previousSnapshotIndex && v.C >= snapshot.PreviousBuyRate)
                  return v.C;
                return null;
              })
          },
          {
            label: "loss/gain",
            fill: '+1',
            yAxisID: 'y-axis-2',
            data:
              rates.map(function (v, i) {
                if (i >= previousSnapshotIndex) {
                  if (i < rates.length - 1 && i > 0) {
                    const previousRate = rates[i - 1];
                    const nextRate = rates[i + 1];
                    const sgn1 = Math.sign(previousRate.C - snapshot.PreviousBuyRate);
                    const sgn2 = Math.sign(v.C - snapshot.PreviousBuyRate);
                    const sgn3 = Math.sign(nextRate.C - snapshot.PreviousBuyRate);
                    if (sgn1 != sgn2 || sgn2 != sgn3)
                      return v.C;
                  }
                }
                return null;
              })
          },
          {
            label: "buy",
            yAxisID: 'y-axis-2',
            data:
              rates.map(function (v, i) {
                if (i >= previousSnapshotIndex)
                  return snapshot.PreviousBuyRate;
                return null;
              })
          }
        ];
      }
    }

    self.lineChart5Labels = snapshot.Rates.map(function (v) {
      return v.T.substr(4, 2) + "." + v.T.substr(2, 2) + "." + v.T.substr(0, 2);
    });

    self.lineChart5Data = GetData(snapshot.Rates);

    const endDate = parseDate(snapshot.Date);
    const startDate = yymmdd(new Date(endDate.setMonth(endDate.getMonth() - 12)));

    let startDateIndex = snapshot.Rates.length - 1;
    for (; startDateIndex >= 0; --startDateIndex) {
      const rateDate = snapshot.Rates[startDateIndex].T;
      if (rateDate == startDate) {
        break;
      }
      if (rateDate < startDate) {
        startDateIndex++;
        break;
      }
    }

    self.lineChart1Labels = self.lineChart5Labels.slice(startDateIndex);

    function sliceData(data: ChartDataSets) {
      return {
        label: data.label,
        yAxisID: data.yAxisID,
        fill: data.fill,
        data: data.data.slice(startDateIndex)
      };
    }

    if (snapshot.PreviousTime == null) {
      self.lineChart1Data = [
        sliceData(self.lineChart5Data[0])
      ];
    } else {
      self.lineChart1Data = [
        sliceData(self.lineChart5Data[0]),
        sliceData(self.lineChart5Data[1]),
        sliceData(self.lineChart5Data[2]),
        sliceData(self.lineChart5Data[3]),
        sliceData(self.lineChart5Data[4])
      ];
    }
  }

  setDecision(decision) {
    const self = this;

    self.spinner.show();
    self.loading = true;
    self.snapshotService.decide({ id: self.snapshot.ID, decision: decision, confirm: self.snapshot.ConfirmDecision, confirmed: self.snapshot.Confirmed }).pipe(first()).subscribe(response => {
      self.spinner.hide();
      self.router.navigate(
        [],
        {
          queryParams: { action: 'random_or_confirm' },
          replaceUrl: false
        });
    },
      error => {
        self.loading = false;
        self.spinner.hide();
        self.handleError(error);
      });
  }
}