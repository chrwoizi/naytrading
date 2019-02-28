'use strict';

angular.
    module('core.suggestions').
    factory('SuggestionsService', ['$resource',
        function ($resource) {
            return $resource('/api/suggestions', {}, {
                query: {
                    method: 'GET',
                    params: {},
                    isArray: true
                }
            });
        }
    ]);