import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

import { AlertService } from '../services/alert.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { ListBase } from '../helpers/ListBase';
import { ChartOptions, ChartDataset, ChartTypeRegistry } from 'chart.js';
import { SaleViewModel } from '../models/stats';
import { StatsService } from '../services/stats.service';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss'],
})
export class StatsComponent extends ListBase<SaleViewModel> implements OnInit {
  public lineChartData: ChartDataset[] = [];
  public lineChartLabels: string[] = [];

  public lineChartOptions: ChartOptions = {
    scales: {
      'y-axis-2': {
        type: 'linear',
        display: true,
        position: 'right',
        ticks: {
          callback: function (value, index, values) {
            return value + '%';
          },
        },
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
    animation: false,
  };

  public lineChartLegend = false;
  public lineChartType: keyof ChartTypeRegistry = 'line';
  public lineChartPlugins = [];

  user!: string;
  users!: string[];
  hasOtherUser!: boolean;
  isSignedInUser!: boolean;
  completeStats!: {
    count: number;
    minReturn: number;
    maxReturn: number;
    sumReturn: number;
    averageReturn: number;
  };
  openStats!: {
    count: number;
    minReturn: number;
    maxReturn: number;
    sumReturn: number;
    averageReturn: number;
  };
  combinedStats!: {
    count: number;
    minReturn: number;
    maxReturn: number;
    sumReturn: number;
    averageReturn: number;
  };
  account!: {
    deposit: any;
    value: any;
    return: number;
    open: any;
    complete: any;
  };

  constructor(
    route: ActivatedRoute,
    alertService: AlertService,
    private statsService: StatsService,
    spinner: NgxSpinnerService
  ) {
    super(route, alertService, spinner);
  }

  ngOnInit() {
    this.orderProp = '-DS';

    super.parseQueryParam();

    this.load(undefined);
  }

  onUserChanged() {
    this.load(this.user);
  }

  load(user) {
    const self = this;
    self.spinner.show();
    self.loading = true;
    self.statsService
      .get(user)
      .pipe(first())
      .subscribe(
        (response) => {
          self.loading = false;
          self.spinner.hide();
          if (response.error) {
            self.handleError(response.error);
          } else {
            self.setStats(user, response.stats);
          }
        },
        (error) => {
          self.spinner.hide();
          self.handleError(error);
        }
      );
  }

  filterItem(value, query): { value: boolean } {
    if (query == 'c' || query == 'o') {
      return { value: value.S == query };
    } else if (query == this.exactQuery) {
      return { value: value.I == query };
    } else {
      return {
        value: value.I.toLowerCase().indexOf(query.toLowerCase()) != -1,
      };
    }
  }

  getId(item) {
    return item.I;
  }

  formatCurrency(n) {
    if (typeof n === 'undefined') return undefined;
    const abbrv = ['', 'T', 'M'];
    let i;
    for (i = 0; i < abbrv.length - 1 && Math.abs(n) >= 1000; ++i) {
      n /= 1000.0;
    }
    return n.toFixed(2) + abbrv[i];
  }

  formatPercentage(n) {
    if (typeof n === 'undefined') return undefined;
    return (n * 100).toFixed(2);
  }

  setStats(user, stats) {
    const self = this;

    self.setItems(stats.Sales);

    self.users = stats.Users;
    self.hasOtherUser = stats.Users.length > 1;
    self.user = user || stats.Users[0];
    self.isSignedInUser = self.user == stats.Users[0];
    self.completeStats = {
      count: 0,
      minReturn: 9999999,
      maxReturn: 0,
      sumReturn: 0,
      averageReturn: 0,
    };
    self.openStats = {
      count: 0,
      minReturn: 9999999,
      maxReturn: 0,
      sumReturn: 0,
      averageReturn: 0,
    };
    self.combinedStats = {
      count: 0,
      minReturn: 9999999,
      maxReturn: 0,
      sumReturn: 0,
      averageReturn: 0,
    };
    self.account = {
      deposit: stats.Deposit,
      value: stats.Value,
      return: (stats.Value - stats.Deposit) / stats.Deposit,
      open: stats.OpenCount,
      complete: stats.CompleteCount,
    };

    for (let i = 0; i < stats.Sales.length; i++) {
      const sale = stats.Sales[i];
      let currentStats = self.completeStats;
      if (sale.S == 'c') {
        currentStats = self.completeStats;
      } else if (sale.S == 'o') {
        currentStats = self.openStats;
      }
      currentStats.count++;
      self.combinedStats.count++;
      currentStats.sumReturn += sale.R;
      self.combinedStats.sumReturn += sale.R;
      currentStats.minReturn = Math.min(currentStats.minReturn, sale.R);
      self.combinedStats.minReturn = Math.min(
        self.combinedStats.minReturn,
        sale.R
      );
      currentStats.maxReturn = Math.max(currentStats.maxReturn, sale.R);
      self.combinedStats.maxReturn = Math.max(
        self.combinedStats.maxReturn,
        sale.R
      );
    }

    self.combinedStats.averageReturn =
      self.combinedStats.sumReturn / self.combinedStats.count;
    self.completeStats.averageReturn =
      self.completeStats.sumReturn / self.completeStats.count;
    self.openStats.averageReturn =
      self.openStats.sumReturn / self.openStats.count;

    if (self.completeStats.count == 0) {
      self.completeStats = {
        count: 0,
        minReturn: NaN,
        maxReturn: NaN,
        sumReturn: NaN,
        averageReturn: NaN,
      };
    }

    if (self.openStats.count == 0) {
      self.openStats = {
        count: 0,
        minReturn: NaN,
        maxReturn: NaN,
        sumReturn: NaN,
        averageReturn: NaN,
      };
    }

    if (self.combinedStats.count == 0) {
      self.combinedStats = {
        count: 0,
        minReturn: NaN,
        maxReturn: NaN,
        sumReturn: NaN,
        averageReturn: NaN,
      };
    }

    self.lineChartLabels = stats.ValueHistory.map(function (v) {
      return v.Time;
    });

    self.lineChartData = [
      {
        label: 'Value',
        yAxisID: 'y-axis-2',
        backgroundColor: 'rgba(151,187,205,0.2)',
        borderColor: 'rgb(151,187,205)',
        data: stats.ValueHistory.map(function (v, i) {
          return 100 * v.Return;
        }),
      },
    ];
  }
}
