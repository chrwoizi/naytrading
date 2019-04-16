'use strict';

// Register `snapshot` component, along with its associated controller and template
angular.
    module('snapshot').
    component('snapshot', {
        templateUrl: '/static/html/snapshot.template.html',
        controller: ['$scope', '$routeParams', 'SnapshotService', 'NewSnapshotService', 'ConfirmSnapshotService', 'SnapshotDecisionService', '$location',
            function SnapshotController($scope, $routeParams, SnapshotService, NewSnapshotService, ConfirmSnapshotService, SnapshotDecisionService, $location) {
                var self = this;

                self.loading = true;
                
                $(".chart").height(0.5 * Chart.helpers.getMaximumWidth($(".chart").get(0)));

                var currentLocation = window.location.href;

                var service = undefined;
                var params = undefined;
                if ($routeParams.instrument) {
                    service = NewSnapshotService;
                    params = { arg: $routeParams.instrument };
                } else if ($routeParams.action) {
                    service = NewSnapshotService;
                    params = { arg: $routeParams.action };
                } else if ($routeParams.decision) {
                    service = ConfirmSnapshotService;
                    params = { id: $routeParams.id, decision: $routeParams.decision, confirmed: $routeParams.confirmed };
                } else {
                    service = SnapshotService;
                    params = { id: $routeParams.id };
                }

                self.snapshot = service.get(params, function (snapshot) {
                    if (currentLocation == window.location.href) {
                        if (snapshot.ConfirmDecision && snapshot.ConfirmDecision > 0) {
                            $location.replaceHistory('/snapshot?id=' + snapshot.ID + "&decision=" + snapshot.ConfirmDecision + "&confirmed=" + snapshot.Confirmed);
                        }
                        else {
                            $location.replaceHistory('/snapshot?id=' + snapshot.ID);
                        }

                        self.setRates(snapshot);

                        self.loading = false;
                    }
                }, function (error) {
                    if (currentLocation == window.location.href) {
                        self.loading = false;

                        window.location.href = '#!/snapshots';

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

                self.setRates = function setRates(snapshot) {

                    if (snapshot.PreviousTime == null) {
                        $scope.series = ["snapshot"];
                        $scope.datasetOverride = [
                            {
                                yAxisID: 'y-axis-2'
                            }
                        ];
                    }
                    else {
                        $scope.series = ["snapshot", "loss", "gain", "loss/gain", "buy"];
                        $scope.datasetOverride = [
                            {
                                yAxisID: 'y-axis-2'
                            },
                            {
                                yAxisID: 'y-axis-2',
                                backgroundColor: 'rgba(255,0,0,0.2)',
                                borderColor: 'red',
                                fill: '+3'
                            },
                            {
                                yAxisID: 'y-axis-2',
                                backgroundColor: 'rgba(0,255,0,0.2)',
                                borderColor: 'green',
                                fill: '+2'
                            },
                            {
                                yAxisID: 'y-axis-2',
                                backgroundColor: 'rgba(255,128,0,0.2)',
                                borderColor: 'orange',
                                fill: '+1'
                            },
                            {
                                yAxisID: 'y-axis-2',
                                backgroundColor: 'rgba(151,187,205,0.2)',
                                borderColor: 'transparent'
                            }
                        ];

                    }

                    $scope.options = {
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

                    function yymmdd(date) {
                        var y = date.getYear();
                        var m = date.getMonth() + 1;
                        var d = date.getDate();
                        var mm = m < 10 ? '0' + m : m;
                        var dd = d < 10 ? '0' + d : d;
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

                    function GetData(rates) {

                        if (snapshot.PreviousTime == null) {
                            return [
                                rates.map(function (v, i) {
                                    return v.C;
                                })
                            ];
                        } else {
                            var previousSnapshotIndex = rates.length - 1;
                            for (var i = 0; i < rates.length; i++) {
                                if (rates[i].T >= snapshot.PreviousTime) {
                                    previousSnapshotIndex = i;
                                    break;
                                }
                            }

                            return [
                                rates.map(function (v, i) {
                                    if (i <= previousSnapshotIndex)
                                        return v.C;
                                    return null;
                                }),
                                rates.map(function (v, i) {
                                    if (i >= previousSnapshotIndex && v.C <= snapshot.PreviousBuyRate)
                                        return v.C;
                                    return null;
                                }),
                                rates.map(function (v, i) {
                                    if (i >= previousSnapshotIndex && v.C >= snapshot.PreviousBuyRate)
                                        return v.C;
                                    return null;
                                }),
                                rates.map(function (v, i) {
                                    if (i >= previousSnapshotIndex) {
                                        if (i < rates.length - 1 && i > 0) {
                                            var previousRate = rates[i - 1];
                                            var nextRate = rates[i + 1];
                                            var sgn1 = Math.sign(previousRate.C - snapshot.PreviousBuyRate);
                                            var sgn2 = Math.sign(v.C - snapshot.PreviousBuyRate);
                                            var sgn3 = Math.sign(nextRate.C - snapshot.PreviousBuyRate);
                                            if (sgn1 != sgn2 || sgn2 != sgn3)
                                                return v.C;
                                        }
                                    }
                                    return null;
                                }),
                                rates.map(function (v, i) {
                                    if (i >= previousSnapshotIndex)
                                        return snapshot.PreviousBuyRate;
                                    return null;
                                })
                            ];
                        }
                    }

                    $scope.labels5 = snapshot.Rates.map(function (v) {
                        return v.T.substr(4, 2) + "." + v.T.substr(2, 2) + "." + v.T.substr(0, 2);
                    });

                    $scope.data5 = GetData(snapshot.Rates);

                    var endDate = parseDate(snapshot.Date);
                    var startDate = yymmdd(new Date(endDate.setMonth(endDate.getMonth() - 12)));

                    var startDateIndex = snapshot.Rates.length - 1;
                    for (; startDateIndex >= 0; --startDateIndex) {
                        var rateDate = snapshot.Rates[startDateIndex].T;
                        if (rateDate == startDate) {
                            break;
                        }
                        if (rateDate < startDate) {
                            startDateIndex++;
                            break;
                        }
                    }

                    $scope.labels1 = $scope.labels5.slice(startDateIndex);

                    if (snapshot.PreviousTime == null) {
                        $scope.data1 = [
                            $scope.data5[0].slice(startDateIndex)
                        ];
                    } else {
                        $scope.data1 = [
                            $scope.data5[0].slice(startDateIndex),
                            $scope.data5[1].slice(startDateIndex),
                            $scope.data5[2].slice(startDateIndex),
                            $scope.data5[3].slice(startDateIndex),
                            $scope.data5[4].slice(startDateIndex),
                        ];
                    }
                };

                self.setDecision = function setDecision(decision) {
                    self.loading = true;
                    SnapshotDecisionService.post({}, { id: self.snapshot.ID, decision: decision, confirm: self.snapshot.ConfirmDecision, confirmed: self.snapshot.Confirmed }, function () {
                        self.loading = false;
                        window.location.href = '#!/snapshot?action=random_or_confirm';
                    }, function (error) {
                        if (typeof (error.data) !== 'undefined' && error.data != null) {
                            console.error('error: ' + JSON.stringify(error.data));
                            if (error.data.error) {
                                if (error.data.error == 'unauthorized') {
                                    window.location.href = '/signin';
                                }
                                else {
                                    alert('error: ' + error.data.error);
                                }
                            }
                        }
                        self.loading = false;
                    });
                };
            }
        ]
    });