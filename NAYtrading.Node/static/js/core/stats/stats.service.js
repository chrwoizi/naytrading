'use strict';

angular.
    module('core.stats').
    factory('StatsService', ['$resource',
        function ($resource) {
            return $resource('/api/stats', {}, {
                query: {
                    method: 'GET',
                    params: {},
                    isArray: false
                }
            });
        }
    ]);