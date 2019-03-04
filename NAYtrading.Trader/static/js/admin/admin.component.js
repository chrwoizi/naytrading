'use strict';

angular.
    module('admin').
    component('admin', {
        templateUrl: '/static/html/admin.template.html',
        controller: ['RunJobService', 'CancelJobService', 'SuspendJobService', 'ContinueJobService', 'GetJobStatusService', 'ReloadConfigService', '$routeParams', '$scope',
            function StatsController(RunJobService, CancelJobService, SuspendJobService, ContinueJobService, GetJobStatusService, ReloadConfigService, $routeParams, $scope) {
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

                self.loading = true;
                GetJobStatusService.get({}, function(status) {
                    self.loading = false;
                    self.isRunning = status.isRunning;
                    self.isSuspended = status.isSuspended;
                    self.log = status.log;
                    $scope.$apply();
                }, function (error) {
                    self.loading = false;
                    handleError(error);
                });

                self.runJob = function () {

                    self.loading = true;
                    RunJobService.post({}, {}, function (result) {
                        self.loading = false;
                        if (result.started) {
                            self.isRunning = true;
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
                            self.isRunning = false;
                        }
                        $scope.$apply();
                    }, function (error) {
                        self.loading = false;
                        handleError(error);
                    });
                };

                self.suspendJob = function () {

                    self.loading = true;
                    SuspendJobService.post({}, {}, function (result) {
                        self.loading = false;
                        if (result.suspended) {
                            self.isRunning = false;
                            self.isSuspended = true;
                        }
                        $scope.$apply();
                    }, function (error) {
                        self.loading = false;
                        handleError(error);
                    });
                };

                self.continueJob = function () {

                    self.loading = true;
                    ContinueJobService.post({}, {}, function (result) {
                        self.loading = false;
                        if (!result.suspended) {
                            self.isSuspended = false;
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