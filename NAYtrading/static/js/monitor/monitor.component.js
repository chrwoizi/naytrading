'use strict';

// Register `monitor` component, along with its associated controller and template
angular.
    module('monitor').
    component('monitor', {
        templateUrl: '/static/html/monitor.template.html',
        controller: ['$scope', '$routeParams', 'MonitorService', '$location',
            function MonitorController($scope, $routeParams, MonitorService, $location) {
                var self = this;

                self.loading = true;

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

                    var sourceTypes = [];
                    for (var monitor of monitors) {
                        function collect(key) {
                            if (key) {
                                for (var sourceType of Object.getOwnPropertyNames(key.sources)) {
                                    if (sourceTypes.indexOf(sourceType) == -1) {
                                        sourceTypes.push(sourceType);
                                    }
                                }
                            }
                        }
                        collect(monitor.preload_ok);
                        collect(monitor.preload_rates);
                        collect(monitor.preload_missing);
                        collect(monitor.preload_invalid);
                        collect(monitor.preload_exception);
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

                    $scope.data = sourceTypes.map(sourceType => {
                        return {
                            sourceType: sourceType,
                            data: [
                                monitors.map(function (v, i) {
                                    return getSum(v.preload_ok, sourceType);
                                }),
                                monitors.map(function (v, i) {
                                    return getSum(v.preload_rates, sourceType);
                                }),
                                monitors.map(function (v, i) {
                                    return getSum(v.preload_missing, sourceType);
                                }),
                                monitors.map(function (v, i) {
                                    return getSum(v.preload_invalid, sourceType);
                                }),
                                monitors.map(function (v, i) {
                                    return getSum(v.preload_exception, sourceType);
                                })
                            ]
                        };
                    });
                };
            }
        ]
    });