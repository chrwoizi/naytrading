!function(angular, undefined) { 'use strict';

  angular.module('ngHistoryReplace', [])
      .run(['$route', '$rootScope', '$location', function ($route, $rootScope, $location) {
        $location.replaceHistory = function (path) {
          if ($location.url() == path) return;

          var routeToKeep = $route.current;
          var un = $rootScope.$on('$locationChangeSuccess', function () {
            if ($location.url() == path) {
              $route.current = routeToKeep;
            }
            un();
          });

          history.replaceState(null, '', "#!" + path);
        };
      }]);

}(window.angular);
