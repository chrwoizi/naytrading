'use strict';

angular.
    module('core.instruments').
    factory('InstrumentService', ['$resource',
        function ($resource) {
            return $resource('/api/instrument/:id', {}, {});
        }
    ]).
    factory('InstrumentListService', ['$resource',
        function ($resource) {
            return $resource('/api/instruments', {}, {
                query: {
                    method: 'GET',
                    params: {},
                    isArray: true
                }
            });
        }
    ]).
    factory('InstrumentAddService', ['$resource',
        function ($resource) {
            return $resource('/api/instruments/add', { url: '@url' }, {
                add: { method: 'POST' }
            });
        }
    ]).
    factory('InstrumentAddIndexService', ['$resource',
        function ($resource) {
            return $resource('/api/instruments/add/default', {}, {
                post: { method: 'POST' }
            });
        }
    ]);