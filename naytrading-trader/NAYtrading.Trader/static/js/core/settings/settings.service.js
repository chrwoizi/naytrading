'use strict';

angular.
    module('core.settings').
    factory('SetTanListService', ['$resource',
        function ($resource) {
            return $resource('/api/tans/set', {}, {
                post: { method: 'POST' }
            });
        }
    ]).
    factory('UnlockTanListService', ['$resource',
        function ($resource) {
            return $resource('/api/tans/unlock', {}, {
                post: { method: 'POST' }
            });
        }
    ]).
    factory('GetUserStatusService', ['$resource',
        function ($resource) {
            return $resource('/api/user/status', {}, {
                query: {
                    method: 'GET',
                    params: {},
                    isArray: false
                }
            });
        }
    ]).
    factory('UnlockBrokerService', ['$resource',
        function ($resource) {
            return $resource('/api/broker/unlock', {}, {
                post: { method: 'POST' }
            });
        }
    ]);