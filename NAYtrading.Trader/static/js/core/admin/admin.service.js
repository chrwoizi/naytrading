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
    factory('SuspendJobService', ['$resource',
        function ($resource) {
            return $resource('/api/job/suspend', {}, {
                post: { method: 'POST' }
            });
        }
    ]).
    factory('ContinueJobService', ['$resource',
        function ($resource) {
            return $resource('/api/job/continue', {}, {
                post: { method: 'POST' }
            });
        }
    ]).
    factory('GetJobStatusService', ['$resource',
        function ($resource) {
            return $resource('/api/job/status', {}, {
                get: { method: 'GET' }
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