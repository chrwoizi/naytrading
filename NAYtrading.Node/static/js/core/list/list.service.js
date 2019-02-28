'use strict';

angular.
    module('core.list').
    factory('ListService', ['$routeParams',
        function ($routeParams) {
            return function(loader, filter, defaultOrder) {
                var list = {};

                list.orderProp = "";

                list.query = "";
                list.filter = filter;

                list.onQueryChanged = function () {
                    list.updateList();
                    $scope.$emit('list:filtered');
                }

                list.onOrderChanged = function () {
                    list.updateList();
                }

                if (typeof ($routeParams.query) == 'string' && $routeParams.query.length > 0) {
                    list.query = $routeParams.query;
                }

                function defaultFailed(error) {
                    if (typeof (error.data) !== 'undefined' && error.data != null) {
                        console.log(JSON.stringify(error.data));
                        if (error.data.error == 'unauthorized') {
                            window.location.href = '/signin';
                        }
                        else {
                            alert('error: ' + JSON.stringify(error.data));
                        }
                    }
                    else if (typeof (error.message) !== 'undefined' && error.message != null) {
                        console.log(error.message);
                        alert('error: ' + JSON.stringify(error.message));
                    }
                }

                list.load = function(args, succeeded, failed = defaultFailed) {
                    list.loading = true;
                    loader(args, function (items) {
                        list.loading = false;
                        list.items = items;
                        list.updateList();
                        list.viewCount = Math.min(100, list.filteredItems.length);
                        list.pagedItems = list.filteredItems.slice(0, list.viewCount);
                        if(succeeded) succeeded();
                    }, function (error) {
                        list.loading = false;
                        if(failed) failed(error);
                    });
                };

                list.loadMore = function () {
                    if (list.loading == false && list.viewCount < list.filteredItems.length) {
                        list.viewCount = Math.min(list.viewCount + 50, list.filteredItems.length);
                        list.pagedItems = list.filteredItems.slice(0, list.viewCount);
                    }
                };

                function getValue(obj, path) {
                    for (var i = 0, path = path.split('.'), len = path.length; i < len; i++) {
                        obj = obj[path[i]];
                    };
                    return obj;
                };

                list.updateList = function () {
                    var filterFn = list.filter(list.query);
                    list.filteredItems = list.items.filter(function (item) {
                        return filterFn(item);
                    });
                    list.filteredItems.sort(function (a, b) {
                        if (list.orderProp.indexOf("-") == 0) {
                            var va = getValue(a, list.orderProp.substr(1));
                            var vb = getValue(b, list.orderProp.substr(1));
                            if (va == vb) {
                                return defaultOrder(a, b);
                            }
                            return va <= vb ? 1 : -1;
                        } else {
                            var va = getValue(a, list.orderProp);
                            var vb = getValue(b, list.orderProp);
                            if (va == vb) {
                                return defaultOrder(a, b);
                            }
                            return va > vb ? 1 : -1;
                        }
                    })
                    list.pagedItems = list.filteredItems.slice(0, list.viewCount);
                };

                return list;
            };
        }
    ]);