var container = $(".container")
container.attr("ng-app", 'math3dApp')

// app = angular.module('math3dApp', ['ui.sortable']);
app = angular.module('math3dApp', ['ui.tree', 'ngAnimate', 'ui.bootstrap']);

app.directive('compileTemplate', ["$compile", "$parse", function($compile, $parse) {
    // http://stackoverflow.com/a/25407201/2747370
    return {
        restrict: 'A',
        link: function($scope, element, attr) {
            var parse = $parse(attr.ngBindHtml);
            function value() { return (parse($scope) || '').toString(); }

            $scope.$watch(value, function() {
                $compile(element, null, -9999)($scope); 
            });
        }
    }
}]);

// http://stackoverflow.com/a/29571230/2747370
app.directive( 'elemReady', function( $parse ) {
   return {
       restrict: 'A',
       link: function( $scope, elem, attrs ) {    
          elem.ready(function(){
            $scope.$apply(function(){
                var func = $parse(attrs.elemReady);
                func($scope);
            })
          })
       }
    }
})

// https://gist.github.com/BobNisco/9885852 (modifications in comments)
// Add this directive where you keep your directives
app.directive('onLongPress', function($timeout) {
    return {
		restrict: 'A',
        link: function(scope, elem, attrs) {
            var timeoutHandler;
            
            elem.bind('mousedown touchstart', function() {
                timeoutHandler = $timeout(function() {
                    scope.$eval(attrs.onLongPress);
                }, 600);
            });

            elem.bind('mouseup touchend', function() {
                $timeout.cancel(timeoutHandler);
            });
		}
	};
})
app.directive('onShortPress', function($timeout) {
	return {
		restrict: 'A',
		link: function($scope, $elm, $attrs) {
			$elm.bind('mousedown touchstart', function(evt) {                
                // Locally scoped variable that will keep track of the short press
				$scope.shortPress = true;

				// After a timeout of 600 ms, shortPress is false;
				$timeout(function() {
					$scope.shortPress=false;
				}, 600);
			});

			$elm.bind('mouseup touchend', function(evt) {
                // Some touchscreens seem to trigger both events, so let's prevent onShortPress action from occuring too often (100ms).
                if ($scope.prevent){
                    return;
                } else {
                    $scope.prevent = true;
    				$timeout(function() {
    					$scope.prevent=false;
    				}, 2000);
                }
                // Prevent the onShortPress event from firing
                if ($scope.shortPress){
					$scope.$apply(function() {
						$scope.$eval($attrs.onShortPress)
					});
                }
				// If there is an on-touch-end function attached to this element, apply it
				if ($attrs.onTouchEnd) {
					$scope.$apply(function() {
						$scope.$eval($attrs.onTouchEnd)
					});
				}
			});
		}
	};
})

app.controller('treeCtrl', function($scope)  {
    $scope.treeOptions = {
        accept: function(sourceNodeScope, destNodesScope, destIndex) {
            return sourceNodeScope.depth() - 1 === destNodesScope.depth()
        },
        toggle: function(collapsed, sourceNodeScope){
            sourceNodeScope.branch.collapsed = collapsed;
            var reflowInterval = setInterval(function(){
                var failures = reflowBranch(sourceNodeScope['branch']);
                if (failures===0){
                    clearInterval(reflowInterval);
                }
            }, 100);
        }
    };
    
    function reflowBranch(branch){
        // If folders are collapsed on page load, mathquill mathfields are initialized in zero-height spans. We need to reflow each of them when the folder is expanded.
        // Reflow only really needs to be done once, has the mq-reflow tracking class.
        var failures = 0;
        _.forEach(branch.objects, function(obj){
            _.forEach(obj.wrappedMathFields, function(wmf){
                
                var mf = wmf.mathfield;
                var el = $(mf.el());
                if (el.css('height')==='0px'){
                    failures += 1;
                }
                else if ( !el.hasClass('mq-reflowed') ){
                    mf.reflow();
                    el.addClass('mq-reflowed');
                }
                
            })
        })
        
        return failures;
    }
});

app.controller('saveCtrl', ['$scope', function($scope){
    $scope.saveURL = function(){
        var url = math3d.saveSettingsAsURL();
        $("#save-modal textarea").val(url);
        $("#url-length").html(url.length);
    };
}])

app.controller('axesSettingsCtrl', ['$scope', function($scope){
    $scope.settings = math3d.settings;
}])

app.controller('addObjectCtrl',['$scope', '$sce', function($scope, $sce) {    
    $scope.debug = arg => console.log(arg);
    
    $scope.mathTree = math3d.mathTree;
    
    $scope.createNewObject = function(type){
        var metaMathObj = {type:type, settings:{}};
        var mathObj = MathObject.renderNewObject(math3d, metaMathObj);
    }
    
    $scope.createNewFolder = function(){
        $scope.mathTree.push({name:'Untitled', objects:[], collapsed:false});
    }
    
    $scope.addOjbectToUi = function(obj){
        var content = `
            <div id="object-${obj.id}" ng-include="'templates/${obj.type.toLowerCase()}.html'">
            </div>`;
        
        //Re-initialize jscolor palletes. This seems hacky.
        setTimeout(function(){ jscolor.installByClassName("jscolor"); }, 0);
        //Re-initialize textarea autosizing
        autosize($("textarea.object-description"))
        
        return $sce.trustAsHtml(content)
    };
    
    $scope.removeFolder = function(branch){
        // Should only be used if branch is empty
        if (branch.objects.length===0){
            _.remove(math3d.mathTree, function(arg){return arg===branch;});
        }
    }
    
    $scope.setupMathGraphicMF = function(obj){
        var el = $(`#object-${obj.id} span.mathquill-large`)
        if (!el.hasClass('has-mq')){
            var keys = {
                Vector: 'components',
                ExplicitSurface: 'rawExpressionZ',
                ExplicitSurfacePolar:'rawExpressionZ',
            }
            var key = keys[obj.type];
            if (key === undefined){ key = 'rawExpression' };
            var mf = new WrappedMathFieldMain(el[0],obj, key);
        }
        
    }
    
    $scope.setupVariableMF = function(obj){
        var elName = $(`#object-${obj.id} span.mathquill-large .variable-rawName`);
        var elEqual = $(`#object-${obj.id} span.mathquill-large .variable-equal`);
        var elExpression = $(`#object-${obj.id} span.mathquill-large .variable-rawExpression`);
        
        if (!elName.hasClass('has-mq')){
            new WrappedMathFieldMain(elName[0], obj, 'rawName', $scope);
            new MathQuill.getInterface(2).StaticMath(elEqual[0]);
        }
        if (!elExpression.hasClass('has-mq')){
            new WrappedMathFieldMain(elExpression[0], obj, 'rawExpression');
        }
    }
    
}]);

app.controller('mathObjectCtrl',['$scope', function($scope){
    $scope.debug = arg => console.log(arg)
    $scope.setColor = function(obj){
        document.getElementById(`jscolor-${obj.id}`).jscolor.show()
    }
    $scope.getStyle = function(obj){
        if (obj.settings.visible){
            var backgroundColor = obj.settings.color;
            var borderColor = Utility.lightenColor(obj.settings.color,-0.5);       
        } else {
            var backgroundColor = 'lightgray';
            var borderColor = 'darkgray';
        }
        return `background-color:${backgroundColor}; border-color:${borderColor}`
    }
}])

app.controller('sliderCtrl', ['$scope', function($scope){
    $scope.intervalID = null;
    $scope.toggleAnimate = function(obj){
        if (!obj.settings.animationRunning){
            $scope.startAnimation(obj)
        }
        else {
            $scope.stopAnimation(obj)
        }
        return
    }
    $scope.startAnimation = function(obj){
        obj.settings.animationRunning = true;
        var ele = document.getElementById("slider-"+obj.id);
        ele.step = ((ele.max-ele.min)/200) * obj.speeds[obj.settings.speedIdx].value;
        $scope.intervalID = setInterval(function(){
           ele.stepUp();
           if (ele.value > ele.max - ele.step){
               ele.value = ele.min
           }
           angular.element(ele).trigger('input')
        },20)
    }
    $scope.stopAnimation = function(obj){
        obj.settings.animationRunning = false;
        clearInterval($scope.intervalID);
    }
    
    $scope.incrementSpeed = function(obj, incr){
        obj.settings.speedIdx += incr;
        obj.settings.speedIdx = MathUtility.clamp(0, obj.settings.speedIdx, obj.speeds.length);
        $scope.toggleAnimate(obj);
        $scope.toggleAnimate(obj);
    }
    
    $scope.initSlider = function(obj){
        var ele = document.getElementById("slider-"+obj.id);
        ele.step = ((ele.max-ele.min)/200) * obj.speeds[obj.settings.speedIdx].value;
        if (obj.animationStarted === undefined && obj.settings.animationRunning){
            $scope.startAnimation(obj);
            obj.animationStarted = true;
        }
    }
    
}])

//http://stackoverflow.com/a/32366115/2747370
//http://codepen.io/dmvianna/pen/OyNNJx
app.controller('popoverCtrl', ['$scope', function($scope) {
    // query popover
    $scope.myPopover = {
        isOpen: false,
        templateUrl: 'templates/settings_popover.html',
        open: function open() {
            $scope.myPopover.isOpen = true;
            $scope.myPopover.data = 'Hello!';
        },
        close: function close() {
            $scope.myPopover.isOpen = false;
        }
    };
}]);

// Prevent key events from bubbling up to the 3d scene
container.on("keypress keydown keyup", function(e) {
    e.stopPropagation();
});