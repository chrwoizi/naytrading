'use strict';

// Register `stats` component, along with its associated controller and template
angular.
    module('stats').
    component('stats', {
        templateUrl: '/static/html/stats.template.html',
        controller: ['StatsService', '$routeParams', '$scope',
            function StatsController(StatsService, $routeParams, $scope) {
                var self = this;

                self.orderProp = "-DS";

                self.query = "";
                self.filter = function (query) {
                    return function (value, index, array) {
                        if (query == "") {
                            return true;
                        } else if (query == "c" || query == "o") {
                            return value.S == query;
                        } else if (query == $routeParams.query) {
                            return value.I == query;
                        } else {
                            return value.I.toLowerCase().indexOf(query.toLowerCase()) != -1;
                        }
                    }
                }

                self.onQueryChanged = function () {
                    self.updateList();
                    $scope.$emit('list:filtered');
                }

                self.onOrderChanged = function () {
                    self.updateList();
                }

                if (typeof ($routeParams.query) == 'string' && $routeParams.query.length > 0) {
                    self.query = $routeParams.query;
                }

                self.formatCurrency = function (n) {
                    if (typeof (n) === 'undefined')
                        return undefined;
                    var abbrv = ["", "T", "M"];
                    for (var i = 0; i < abbrv.length - 1 && Math.abs(n) >= 1000; ++i) {
                        n /= 1000.0;
                    }
                    return n.toFixed(2) + abbrv[i];
                }

                self.formatPercentage = function (n) {
                    if (typeof (n) === 'undefined')
                        return undefined;
                    return (n * 100).toFixed(2);
                }

                self.loading = true;
                self.stats = StatsService.query({}, function (stats) {
                    self.loading = false;
                    self.completeStats = {
                        count: 0,
                        minReturn: 9999999,
                        maxReturn: 0,
                        sumReturn: 0
                    };
                    self.openStats = {
                        count: 0,
                        minReturn: 9999999,
                        maxReturn: 0,
                        sumReturn: 0
                    };
                    self.combinedStats = {
                        count: 0,
                        minReturn: 9999999,
                        maxReturn: 0,
                        sumReturn: 0
                    };
                    self.account = {
                        deposit: stats.Deposit,
                        value: stats.Value,
                        return: (stats.Value - stats.Deposit) / stats.Deposit,
                        open: stats.OpenCount,
                        complete: stats.CompleteCount
                    };

                    for (var i = 0; i < stats.Sales.length; i++) {
                        var sale = stats.Sales[i];
                        var currentStats = self.completeStats;
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
                        self.combinedStats.minReturn = Math.min(self.combinedStats.minReturn, sale.R);
                        currentStats.maxReturn = Math.max(currentStats.maxReturn, sale.R);
                        self.combinedStats.maxReturn = Math.max(self.combinedStats.maxReturn, sale.R);
                    }

                    self.combinedStats.averageReturn = self.combinedStats.sumReturn / self.combinedStats.count;
                    self.completeStats.averageReturn = self.completeStats.sumReturn / self.completeStats.count;
                    self.openStats.averageReturn = self.openStats.sumReturn / self.openStats.count;

                    if (self.completeStats.count == 0) {
                        self.completeStats = {
                            count: 0,
                            minReturn: NaN,
                            maxReturn: NaN,
                            sumReturn: NaN,
                            averageReturn: NaN
                        };
                    }

                    if (self.openStats.count == 0) {
                        self.openStats = {
                            count: 0,
                            minReturn: NaN,
                            maxReturn: NaN,
                            sumReturn: NaN,
                            averageReturn: NaN
                        };
                    }

                    if (self.combinedStats.count == 0) {
                        self.combinedStats = {
                            count: 0,
                            minReturn: NaN,
                            maxReturn: NaN,
                            sumReturn: NaN,
                            averageReturn: NaN
                        };
                    }

                    self.series = ["Value"];
                    self.datasetOverride = [
                        {
                            yAxisID: 'y-axis-2'
                        }
                    ];

                    self.options = {
                        scales: {
                            yAxes: [
                                {
                                    id: 'y-axis-2',
                                    type: 'linear',
                                    display: true,
                                    position: 'right',
                                    ticks: {
                                        callback: function (value, index, values) {
                                            return value + '%';
                                        }
                                    }
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
                        animation: false
                    };

                    self.labels = stats.ValueHistory.map(function (v) {
                        return v.Time;
                    });

                    self.data = stats.ValueHistory.map(function (v, i) {
                        return 100 * v.Return;
                    });

                    self.updateList();
                    self.viewCount = Math.min(100, self.filteredItems.length);
                    self.pagedItems = self.filteredItems.slice(0, self.viewCount);
                }, function (error) {
                    self.loading = false;
                    if (typeof (error.data) !== 'undefined' && error.data != null) {
                        if (error.data.error == 'unauthorized') {
                            window.location.href = 'signin';
                        }
                        else {
                            alert('error: ' + JSON.stringify(error.data));
                        }
                    }
                });

                self.loadMore = function () {
                    if (self.loading == false && self.viewCount < self.filteredItems.length) {
                        self.viewCount = Math.min(self.viewCount + 50, self.filteredItems.length);
                        self.pagedItems = self.filteredItems.slice(0, self.viewCount);
                    }
                };

                var getValue = function (obj, path) {
                    for (var i = 0, path = path.split('.'), len = path.length; i < len; i++) {
                        obj = obj[path[i]];
                    };
                    return obj;
                };

                self.updateList = function () {
                    var filterFn = self.filter(self.query);
                    self.filteredItems = self.stats.Sales.filter(function (item) {
                        return filterFn(item);
                    });
                    self.filteredItems.sort(function (a, b) {
                        if (self.orderProp.indexOf("-") == 0) {
                            var va = getValue(a, self.orderProp.substr(1));
                            var vb = getValue(b, self.orderProp.substr(1));
                            if (va == vb) {
                                return a.I <= b.I ? 1 : -1;
                            }
                            return va <= vb ? 1 : -1;
                        } else {
                            var va = getValue(a, self.orderProp);
                            var vb = getValue(b, self.orderProp);
                            if (va == vb) {
                                return a.I > b.I ? 1 : -1;
                            }
                            return va > vb ? 1 : -1;
                        }
                    })
                    self.pagedItems = self.filteredItems.slice(0, self.viewCount);
                }
            }
        ]
    });