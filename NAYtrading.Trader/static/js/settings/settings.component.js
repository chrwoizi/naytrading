'use strict';

angular.
    module('settings').
    component('settings', {
        templateUrl: '/static/html/settings.template.html',
        controller: ['GetUserStatusService', 'SetTanListService', 'UnlockTanListService', 'UnlockBrokerService', '$routeParams', '$scope',
            function StatsController(GetUserStatusService, SetTanListService, UnlockTanListService, UnlockBrokerService, $routeParams, $scope) {
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

                self.isTanListSet = false;
                self.tanListColumns = [];
                self.tanListRows = [];
                self.tans = {};

                self.isTanListUnlocked = false;
                self.tanListPassword = "";

                self.isBrokerUnlocked = false;
                self.brokerUser = "";
                self.brokerPassword = "";

                self.loading = true;
                GetUserStatusService.get({}, function (status) {
                    self.loading = false;

                    self.isRunning = status.isRunning;
                    self.nextRun = status.nextRun;

                    self.isBrokerUnlocked = status.isUnlocked;

                    self.isTanListSet = status.isTanListSet;

                    self.isTanListUnlocked = status.isTanListUnlocked;

                    self.tanListRows = status.rows;
                    self.tanListColumns = status.columns;

                    for (var r = 0; r < self.tanListRows.length; ++r) {
                        var row = self.tanListRows[r];
                        for (var c = 0; c < self.tanListColumns.length; ++c) {
                            var col = self.tanListColumns[c];
                            self.tans["" + row + col] = "";
                        }
                    }
                }, function (error) {
                    self.loading = false;
                    handleError(error);
                });

                self.editTanList = function () {
                    self.isTanListSet = false;
                };

                self.saveTanList = function () {

                    var tanList = "";
                    for (var r = 0; r < self.tanListRows.length; ++r) {
                        var row = self.tanListRows[r];
                        for (var c = 0; c < self.tanListColumns.length; ++c) {
                            var col = self.tanListColumns[c];
                            if (r > 0 || c > 0) {
                                tanList += ",";
                            }
                            tanList += self.tans["" + row + col];
                        }
                    }

                    self.loading = true;
                    SetTanListService.post({}, { password: self.tanListPassword, tanList: tanList }, function () {
                        self.loading = false;
                        self.showTanList = false;
                        self.isTanListSet = true;
                        self.isTanListUnlocked = true;
                        $scope.$apply();
                    }, function (error) {
                        self.loading = false;
                        handleError(error);
                    });
                };

                self.unlockTanList = function () {

                    self.loading = true;
                    UnlockTanListService.post({}, { password: self.tanListPassword }, function () {
                        self.loading = false;
                        self.isTanListUnlocked = true;
                        $scope.$apply();
                    }, function (error) {
                        self.loading = false;
                        handleError(error);
                    });
                };

                self.unlockBroker = function () {

                    self.loading = true;
                    UnlockBrokerService.post({}, { user: self.brokerUser, password: self.brokerPassword }, function () {
                        self.loading = false;
                        self.isBrokerUnlocked = true;
                    }, function (error) {
                        self.loading = false;
                        handleError(error);
                    });
                };
                
                self.editBroker = function () {
                    self.isBrokerUnlocked = false;
                };
            }
        ]
    });