import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { Color, Label } from 'ng2-charts';

import { AlertService } from '../services/alert.service';
import { MonitorService } from '../services/monitor.service';
import { ChartOptions, ChartDataSets } from 'chart.js';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-monitor',
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.scss']
})
export class MonitorComponent implements OnInit {
  loading = false;

  public lineChartData: { sourceType: string, dataSets: ChartDataSets[] }[] = [];

  public lineChartLabels: Label[] = [];

  public lineChartOptions: ChartOptions = {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        fontColor: "#000080",
      }
    },
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

  public lineChartColors: Color[] = [
    {
      backgroundColor: 'transparent',
      borderColor: 'green',
      pointBackgroundColor: 'green',
      pointBorderColor: 'green'
    },
    {
      backgroundColor: 'transparent',
      borderColor: 'yellow',
      pointBackgroundColor: 'yellow',
      pointBorderColor: 'yellow'
    },
    {
      backgroundColor: 'transparent',
      borderColor: 'orange',
      pointBackgroundColor: 'orange',
      pointBorderColor: 'orange'
    },
    {
      backgroundColor: 'transparent',
      borderColor: 'red',
      pointBackgroundColor: 'red',
      pointBorderColor: 'red'
    },
    {
      backgroundColor: 'transparent',
      borderColor: 'purple',
      pointBackgroundColor: 'purple',
      pointBorderColor: 'purple'
    }
  ];
  public lineChartLegend = true;
  public lineChartType = 'line';
  public lineChartPlugins = [];

  constructor(
    private alertService: AlertService,
    private monitorService: MonitorService,
    private spinner: NgxSpinnerService
  ) {
  }

  ngOnInit() {
    var self = this;

    self.spinner.show();
    self.loading = true;
    this.monitorService.get().pipe(first()).subscribe(monitors => {
      self.spinner.hide();
      self.loading = false;
      self.setMonitors(monitors.days);
    },
      error => {
        self.spinner.hide();
        self.alertService.error(error ? error.error : "");
      });
  }

  setMonitors(monitors) {

    this.lineChartLabels = monitors.map(function (v) {
      return v.T.substr(4, 2) + "." + v.T.substr(2, 2) + "." + v.T.substr(0, 2);
    });

    var sourceTypes = [];
    for (var monitor of monitors) {
      this.collect(sourceTypes, monitor.preload_ok);
      this.collect(sourceTypes, monitor.preload_rates);
      this.collect(sourceTypes, monitor.preload_missing);
      this.collect(sourceTypes, monitor.preload_invalid);
      this.collect(sourceTypes, monitor.preload_exception);
    }

    function getSum(key, sourceType) {
      if (key && key.sources[sourceType]) {
        if (typeof (key.sources[sourceType]) == 'number') {
          return key.sources[sourceType] || 0;
        }
        else {
          return key.sources[sourceType].sum || 0;
        }
      }
      else {
        return 0;
      }
    }

    this.lineChartData = sourceTypes.map(sourceType => {
      var dataSets: ChartDataSets[] = [
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_ok, sourceType);
          }),
          label: 'ok',
          fill: false,
          yAxisID: 'y-axis-2'
        },
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_rates, sourceType);
          }),
          label: 'rates',
          fill: false,
          yAxisID: 'y-axis-2'
        },
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_missing, sourceType);
          }),
          label: 'missing',
          fill: false,
          yAxisID: 'y-axis-2'
        },
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_invalid, sourceType);
          }),
          label: 'invalid',
          fill: false,
          yAxisID: 'y-axis-2'
        },
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_exception, sourceType);
          }),
          label: 'exception',
          fill: false,
          yAxisID: 'y-axis-2'
        }];

      return {
        sourceType: sourceType,
        dataSets: dataSets
      };
    });
  }

  collect(sourceTypes, key) {
    if (key) {
      for (var sourceType of Object.getOwnPropertyNames(key.sources)) {
        if (sourceTypes.indexOf(sourceType) == -1) {
          sourceTypes.push(sourceType);
        }
      }
    }
  }
}