import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService } from '../services/alert.service';
import { MonitorService } from '../services/monitor.service';
import { ChartOptions, ChartDataset, ChartTypeRegistry } from 'chart.js';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-monitor',
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.scss'],
})
export class MonitorComponent implements OnInit {
  loading = false;

  public lineChartData: { sourceType: string; dataSets: ChartDataset[] }[] = [];

  public lineChartLabels: string[] = [];

  public lineChartOptions: ChartOptions = {
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#000080',
        },
      },
    },
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
          maxRotation: 0, // angle in degrees
        },
      },
    },
    elements: {
      point: {
        radius: 0,
      },
    },
    responsive: true,
  };

  public lineChartLegend = true;
  public lineChartType: keyof ChartTypeRegistry = 'line';
  public lineChartPlugins = [];

  constructor(
    private alertService: AlertService,
    private monitorService: MonitorService,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit() {
    const self = this;

    self.spinner.show();
    self.loading = true;
    this.monitorService
      .get()
      .pipe(first())
      .subscribe(
        (monitors) => {
          self.spinner.hide();
          self.loading = false;
          self.setMonitors(monitors.days);
        },
        (error) => {
          self.spinner.hide();
          self.alertService.error(error);
        }
      );
  }

  setMonitors(monitors) {
    this.lineChartLabels = monitors.map(function (v) {
      return v.T.substr(4, 2) + '.' + v.T.substr(2, 2) + '.' + v.T.substr(0, 2);
    });

    const sourceTypes = [];
    for (const monitor of monitors) {
      this.collect(sourceTypes, monitor.preload_ok);
      this.collect(sourceTypes, monitor.preload_rates);
      this.collect(sourceTypes, monitor.preload_missing);
      this.collect(sourceTypes, monitor.preload_invalid);
      this.collect(sourceTypes, monitor.preload_exception);
    }

    function getSum(key, sourceType) {
      if (key && key.sources[sourceType]) {
        if (typeof key.sources[sourceType] == 'number') {
          return key.sources[sourceType] || 0;
        } else {
          return key.sources[sourceType].sum || 0;
        }
      } else {
        return 0;
      }
    }

    this.lineChartData = sourceTypes.map((sourceType) => {
      const dataSets: ChartDataset[] = [
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_ok, sourceType);
          }),
          label: 'ok',
          fill: false,
          yAxisID: 'y-axis-2',
          backgroundColor: 'transparent',
          borderColor: 'green',
          pointBackgroundColor: 'green',
          pointBorderColor: 'green',
        },
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_rates, sourceType);
          }),
          label: 'rates',
          fill: false,
          yAxisID: 'y-axis-2',
          backgroundColor: 'transparent',
          borderColor: 'yellow',
          pointBackgroundColor: 'yellow',
          pointBorderColor: 'yellow',
        },
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_missing, sourceType);
          }),
          label: 'missing',
          fill: false,
          yAxisID: 'y-axis-2',
          backgroundColor: 'transparent',
          borderColor: 'orange',
          pointBackgroundColor: 'orange',
          pointBorderColor: 'orange',
        },
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_invalid, sourceType);
          }),
          label: 'invalid',
          fill: false,
          yAxisID: 'y-axis-2',
          backgroundColor: 'transparent',
          borderColor: 'red',
          pointBackgroundColor: 'red',
          pointBorderColor: 'red',
        },
        {
          data: monitors.map(function (v, i) {
            return getSum(v.preload_exception, sourceType);
          }),
          label: 'exception',
          fill: false,
          yAxisID: 'y-axis-2',
          backgroundColor: 'transparent',
          borderColor: 'purple',
          pointBackgroundColor: 'purple',
          pointBorderColor: 'purple',
        },
      ];

      return {
        sourceType: sourceType,
        dataSets: dataSets,
      };
    });
  }

  collect(sourceTypes, key) {
    if (key) {
      for (const sourceType of Object.getOwnPropertyNames(key.sources)) {
        if (sourceTypes.indexOf(sourceType) == -1) {
          sourceTypes.push(sourceType);
        }
      }
    }
  }
}
