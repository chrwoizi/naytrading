'use strict';

angular.
    module('suggestion').
    component('suggestion', {
        templateUrl: '/static/html/suggestion.template.html',
        controller: ['ListService', 'SuggestionService', '$routeParams', '$scope',
            function StatsController(ListService, SuggestionService, $routeParams, $scope) {
                var self = this;

                self.formatCurrency = function (n) {
                    if (typeof (n) === 'undefined')
                        return undefined;
                    var abbrv = ["", "T", "M"];
                    for (var i = 0; i < abbrv.length - 1 && Math.abs(n) >= 1000; ++i) {
                        n /= 1000.0;
                    }
                    return n.toFixed(2) + abbrv[i];
                }

                self.toggleShowMessage = function(log) {
                    log.showMessage = !log.showMessage;
                }

                var loadLogs = function(args, succeeded, failed) {
                    args.id = $routeParams.id;
                    SuggestionService.get(args, function (data) {
                        self.suggestion = data;
                        if(succeeded) succeeded(data.logs);
                    }, function (error) {
                        self.suggestion = null;
                        if(failed) failed(error);
                    });
                };

                var filterLogs = function (query) {
                    return function (value, index, array) {
                        return true;
                    }
                };

                var orderLogs = function (a, b) {
                    return a.Time <= b.Time ? 1 : -1;
                };

                self.logs = ListService(loadLogs, filterLogs, orderLogs);
                self.logs.load({});
            }
        ]
    });