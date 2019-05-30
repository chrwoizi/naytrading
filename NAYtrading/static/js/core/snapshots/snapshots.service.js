'use strict';

angular.
    module('core.snapshots').
    factory('NewSnapshotService', ['$resource',
        function ($resource) {
            return $resource('/api/snapshot/new/:arg', {}, {});
        }
    ]).
    factory('SnapshotService', ['$resource',
        function ($resource) {
            return $resource('/api/snapshot/:id', {}, {});
        }
    ]).
    factory('ConfirmSnapshotService', ['$resource',
        function ($resource) {
            return $resource('/api/confirm/:id/:decision/:confirmed', {}, {});
        }
    ]).
    factory('SnapshotDecisionService', ['$resource',
        function ($resource) {
            return $resource('/api/decision', {}, {
                post: { method: 'POST' }
            });
        }
    ]).
    factory('SnapshotListService', ['$resource',
        function ($resource) {
            return $resource('/api/snapshots/:instrument', {}, {
                query: {
                    method: 'GET',
                    params: {},
                    isArray: true
                }
            });
        }
    ]);