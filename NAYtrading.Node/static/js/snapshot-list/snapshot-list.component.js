'use strict';

// Register `snapshotList` component, along with its associated controller and template
angular.
    module('snapshotList').
    component('snapshotList', {
        templateUrl: '/static/html/snapshot-list.template.html',
        controller: ['SnapshotListService', '$routeParams', '$scope',
            function SnapshotListController(SnapshotListService, $routeParams, $scope) {
                var self = this;

                self.orderProp = "-ModifiedDateSortable";

                self.query = "";
                self.filter = function (query) {
                    return function (value, index, array) {
                        if (query == "") {
                            return true;
                        } else if (query == "buy" || query == "wait" || query == "wait1yr" || query == "autowait" || query == "sell") {
                            return value.Decision == query;
                        } else if (query == $routeParams.query) {
                            return value.Instrument.InstrumentName == query;
                        } else {
                            return value.Instrument.InstrumentName.toLowerCase().indexOf(query.toLowerCase()) != -1;
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

                self.loading = true;
                self.snapshots = SnapshotListService.query({}, function () {
                    self.loading = false;
                    self.updateList();
                    self.viewCount = Math.min(100, self.filteredItems.length);
                    self.pagedItems = self.filteredItems.slice(0, self.viewCount);
                }, function (error) {
                    self.loading = false;
                    if (typeof (error.data) !== 'undefined' && error.data != null) {
                        if (error.data.error == 'unauthorized') {
                            window.location.href = '/signin';
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
                    self.filteredItems = self.snapshots.filter(function (item) {
                        return filterFn(item);
                    });
                    self.filteredItems.sort(function (a, b) {
                        if (self.orderProp.indexOf("-") == 0) {
                            var va = getValue(a, self.orderProp.substr(1));
                            var vb = getValue(b, self.orderProp.substr(1));
                            if (va == vb) {
                                return a.ID <= b.ID ? 1 : -1;
                            }
                            return va <= vb ? 1 : -1;
                        } else {
                            var va = getValue(a, self.orderProp);
                            var vb = getValue(b, self.orderProp);
                            if (va == vb) {
                                return a.ID > b.ID ? 1 : -1;
                            }
                            return va > vb ? 1 : -1;
                        }
                    })
                    self.pagedItems = self.filteredItems.slice(0, self.viewCount);
                }
            }
        ]
    });