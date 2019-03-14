'use strict';

angular.
    module('naytradingApp').
    config(['$routeProvider',
        function config($routeProvider) {
            $routeProvider.
                when('/settings', {
                    template: '<settings></settings>'
                }).
                when('/admin', {
                    template: '<admin></admin>'
                }).
                otherwise('/settings');
        }
    ]);

angular.module('infinite-scroll').value('THROTTLE_MILLISECONDS', 250);