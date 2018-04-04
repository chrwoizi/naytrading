'use strict';

angular.
    module('core.snapshots').
    factory('NewSnapshotService', ['$resource',
        function ($resource) {
            return $resource('/api/snapshot/new/:instrumentId', {}, {});
        }
    ]).
    factory('SnapshotService', ['$resource',
        function ($resource) {
            return $resource('/api/snapshot/:id', {}, {});
        }
    ]).
    factory('SnapshotDecisionService', ['$resource',
        function ($resource) {
            return $resource('/api/snapshot/:id/set/:decision', {}, {});
        }
    ]).
    factory('SnapshotListService', ['$resource',
        function ($resource) {
            return $resource('/api/snapshot', {}, {
                query: {
                    method: 'GET',
                    params: {},
                    isArray: true
                }
            });
        }
    ]);