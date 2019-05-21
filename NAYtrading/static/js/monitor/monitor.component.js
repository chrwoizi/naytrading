'use strict';

// Register `monitor` component, along with its associated controller and template
angular.
    module('monitor').
    component('monitor', {
        templateUrl: '/static/html/monitor.template.html',
        controller: ['$scope', '$routeParams', 'MonitorService', '$location',
            function SnapshotController($scope, $routeParams, MonitorService, $location) {
                var self = this;

                self.loading = true;

                $(".chart").height(0.5 * Chart.helpers.getMaximumWidth($(".chart").get(0)));

                var currentLocation = window.location.href;

                self.monitors = MonitorService.get({}, function (monitors) {
                    self.setMonitors(monitors.days);
                    self.loading = false;
                }, function (error) {
                    if (currentLocation == window.location.href) {
                        self.loading = false;

                        window.location.href = '#!/stats';

                        if (typeof (error.data) !== 'undefined' && error.data != null) {
                            console.error('error: ' + JSON.stringify(error.data));
                            if (typeof (error.data.error) === 'string' && error.data.error.length > 0) {
                                if (error.data.error == 'unauthorized') {
                                    window.location.href = '/signin';
                                }
                                else {
                                    alert('error: ' + error.data.error);
                                }
                            }
                        }
                    }
                });

                self.setMonitors = function setMonitors(monitors) {

                    $scope.series = ["ok", "rates", "missing", "invalid", "exception"];
                    $scope.datasetOverride = [
                        {
                            label: 'ok',
                            fill: false,
                            yAxisID: 'y-axis-2',
                            backgroundColor: 'transparent',
                            borderColor: 'green',
                            pointBackgroundColor: 'green',
                            pointBorderColor: 'green'
                        },
                        {
                            label: 'rates',
                            fill: false,
                            yAxisID: 'y-axis-2',
                            backgroundColor: 'transparent',
                            borderColor: 'yellow',
                            pointBackgroundColor: 'yellow',
                            pointBorderColor: 'yellow'
                        },
                        {
                            label: 'missing',
                            fill: false,
                            yAxisID: 'y-axis-2',
                            backgroundColor: 'transparent',
                            borderColor: 'orange',
                            pointBackgroundColor: 'orange',
                            pointBorderColor: 'orange'
                        },
                        {
                            label: 'invalid',
                            fill: false,
                            yAxisID: 'y-axis-2',
                            backgroundColor: 'transparent',
                            borderColor: 'red',
                            pointBackgroundColor: 'red',
                            pointBorderColor: 'red'
                        },
                        {
                            label: 'exception',
                            fill: false,
                            yAxisID: 'y-axis-2',
                            backgroundColor: 'transparent',
                            borderColor: 'purple',
                            pointBackgroundColor: 'purple',
                            pointBorderColor: 'purple'
                        }
                    ];

                    $scope.options = {
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
                        animation: false
                    };

                    $scope.labels = monitors.map(function (v) {
                        return v.T.substr(4, 2) + "." + v.T.substr(2, 2) + "." + v.T.substr(0, 2);
                    });

                    $scope.data = [
                        monitors.map(function (v, i) {
                            return v.preload_ok ? v.preload_ok.sum : 0;
                        }),
                        monitors.map(function (v, i) {
                            return v.preload_rates ? v.preload_rates.sum : 0;
                        }),
                        monitors.map(function (v, i) {
                            return v.preload_missing ? v.preload_missing.sum : 0;
                        }),
                        monitors.map(function (v, i) {
                            return v.preload_invalid ? v.preload_invalid.sum : 0;
                        }),
                        monitors.map(function (v, i) {
                            return v.preload_exception ? v.preload_exception.sum : 0;
                        })
                    ];
                };
            }
        ]
    });