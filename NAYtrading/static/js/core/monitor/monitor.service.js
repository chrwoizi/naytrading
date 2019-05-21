'use strict';

angular.
    module('core.monitor').
    factory('MonitorService', ['$resource',
        function ($resource) {
            return $resource('/api/monitor', {}, {
                query: {
                    method: 'GET',
                    params: {},
                    isArray: false
                }
            });
        }
    ]);