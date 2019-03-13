'use strict';

angular.
    module('naytradingApp').
    config(['$routeProvider',
        function config($routeProvider) {
            $routeProvider.
                when('/stats', {
                    template: '<stats></stats>'
                }).
                when('/snapshots', {
                    template: '<snapshot-list></snapshot-list>'
                }).
                when('/snapshot', {
                    template: '<snapshot></snapshot>'
                }).
                when('/instruments', {
                    template: '<instrument-list></instrument-list>'
                }).
                when('/snapshots/:query', {
                    template: '<snapshot-list></snapshot-list>'
                }).
                when('/suggestions', {
                    template: '<suggestions></suggestions>'
                }).
                when('/suggestion/:id', {
                    template: '<suggestion></suggestion>'
                }).
                otherwise('/stats');
        }
    ]);

angular.module('infinite-scroll').value('THROTTLE_MILLISECONDS', 250);