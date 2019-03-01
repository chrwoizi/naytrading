'use strict';

angular.
    module('core.admin').
    factory('RunJobService', ['$resource',
        function ($resource) {
            return $resource('/api/job/run', {}, {
                post: { method: 'POST' }
            });
        }
    ]).
    factory('CancelJobService', ['$resource',
        function ($resource) {
            return $resource('/api/job/cancel', {}, {
                post: { method: 'POST' }
            });
        }
    ]).
    factory('ReloadConfigService', ['$resource',
        function ($resource) {
            return $resource('/api/config/reload', {}, {
                post: { method: 'POST' }
            });
        }
    ]);