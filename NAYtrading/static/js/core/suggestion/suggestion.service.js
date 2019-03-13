'use strict';

angular.
    module('core.suggestion').
    factory('SuggestionService', ['$resource',
        function ($resource) {
            return $resource('/api/suggestion/:id', {}, {});
        }
    ]);