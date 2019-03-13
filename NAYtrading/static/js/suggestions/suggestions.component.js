'use strict';

angular.
    module('suggestions').
    component('suggestions', {
        templateUrl: '/static/html/suggestions.template.html',
        controller: ['ListService', 'SuggestionsService', '$routeParams', '$scope',
            function StatsController(ListService, SuggestionsService, $routeParams, $scope) {
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
                
                self.getStatusIcon = function(status) {
                    switch(status) {
                        case 'i': return 'glyphicon-asterisk';
                        case 't': return 'glyphicon-repeat';
                        case 'f': return 'glyphicon-remove';
                        case 'p': return 'glyphicon-time';
                        case 'c': return 'glyphicon-ok';
                        default: return 'glyphicon-question-sign';
                    }
                };

                self.getActionIcon = function(action) {
                    switch(action) {
                        case 'buy': return 'glyphicon-log-in';
                        case 'sell': return 'glyphicon-log-out';
                        default: return 'glyphicon-question-sign';
                    }
                };

                var loadSuggestions = function(args, succeeded, failed) {
                    SuggestionsService.query(args, function (data) {
                        if(succeeded) succeeded(data);
                    }, function (error) {
                        if(failed) failed(error);
                    });
                };

                var filterSuggestions = function (query) {
                    return function (value, index, array) {
                        if (query == "") {
                            return true;
                        } else if (query == "i" || query == "p" || query == "t" || query == "f" || query == "c") {
                            return value.S == query;
                        } else if (query == $routeParams.query) {
                            return value.I == query;
                        } else {
                            return value.I.toLowerCase().indexOf(query.toLowerCase()) != -1;
                        }
                    }
                };

                var orderSuggestions = function (a, b) {
                    return a.I <= b.I ? 1 : -1;
                };

                self.suggestions = ListService(loadSuggestions, filterSuggestions, orderSuggestions);
                self.suggestions.orderProp = "-TS";

                self.suggestions.load({});
            }
        ]
    });