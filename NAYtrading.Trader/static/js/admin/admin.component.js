'use strict';

angular.
    module('admin').
    component('admin', {
        templateUrl: '/static/html/admin.template.html',
        controller: ['RunJobService', 'CancelJobService', 'ReloadConfigService', '$routeParams', '$scope',
            function StatsController(RunJobService, CancelJobService, ReloadConfigService, $routeParams, $scope) {
                var self = this;

                function handleError(error) {
                    if (typeof (error.data) !== 'undefined' && error.data != null) {
                        if (error.data.error == 'unauthorized') {
                            window.location.href = '/signin';
                        }
                        else {
                            alert('error: ' + JSON.stringify(error.data));
                        }
                    }
                }

                self.runJob = function () {

                    self.loading = true;
                    RunJobService.post({}, {}, function (result) {
                        self.loading = false;
                        if (result.started) {
                            alert("Job was started.");
                        }
                        else {
                            alert("Job is already running");
                        }
                        $scope.$apply();
                    }, function (error) {
                        self.loading = false;
                        handleError(error);
                    });
                };

                self.cancelJob = function () {

                    self.loading = true;
                    CancelJobService.post({}, {}, function (result) {
                        self.loading = false;
                        if (result.stopped) {
                            alert("Job was stopped.");
                        }
                        else {
                            alert("Job was not running");
                        }
                        $scope.$apply();
                    }, function (error) {
                        self.loading = false;
                        handleError(error);
                    });
                };

                self.reloadConfig = function () {

                    self.loading = true;
                    ReloadConfigService.post({}, {}, function () {
                        self.loading = false;
                        $scope.$apply();
                    }, function (error) {
                        self.loading = false;
                        handleError(error);
                    });
                };

            }
        ]
    });