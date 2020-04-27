var naviAPI = "http://10.90.144.156:8070";
var polylines = [];
var adjacent_polylines = [];
var lat1 = [];
var lng1 = [];
var lat2 = [];
var lng2 = [];
var lengthMinimum = 0;
var lengthRecommend = 0;
var clockDot = ":";
var diffHour = 0;
var currentDate = new Date();
var mapContainer;
var map;
var route_markers = [];
var target_markers = [];
var route_node_id = [];
var startMarker;
var arriveMarker;
var featureMarkersChildren = [];
var featureMarkersEnforce = [];
var featureMarkersSignal = [];
var featureOnRecommendRoute = [];
var featureOnMinimumRoute = [];
var blueMarkerImage = new daum.maps.MarkerImage("http://t1.daumcdn.net/localimg/localimages/07/mapjsapi/default_marker.png", new daum.maps.Size(40, 42));
var yellowMarkerImage = new daum.maps.MarkerImage("http://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png", new daum.maps.Size(24, 35));
var nexoMarkerImage = new daum.maps.MarkerImage("./image/nexo.png", new daum.maps.Size(60, 35));
var mapRouteClickListner = function(mouseEvent) {

    // 지도 위에 로드뷰 도로 오버레이가 추가된 상태가 아니면 클릭이벤트를 무시합니다
    // 마우스로 클릭한 위치입니다
    var clickPosition = mouseEvent.latLng;

    makeNextTarget(clickPosition.getLat(), clickPosition.getLng());
};
var routeLinePath = [];
var routeLine =  new daum.maps.Polyline({
    path: routeLinePath, // 선을 구성하는 좌표배열 입니다
    strokeWeight: 5, // 선의 두께 입니다
    strokeColor: 'blue', // 선의 색깔입니다
    strokeOpacity: 0.7, // 선의 불투명도 입니다 1에서 0 사이의 값이며 0에 가까울수록 투명합니다
    strokeStyle: 'solid', // 선의 스타일입니다
    endArrow: true
});
var infoWindow;
var dijkstraLinePath = [];
var dijkstraLine =  new daum.maps.Polyline({
    path: dijkstraLinePath, // 선을 구성하는 좌표배열 입니다
    strokeWeight: 5, // 선의 두께 입니다
    strokeColor: 'red', // 선의 색깔입니다
    strokeOpacity: 0.7, // 선의 불투명도 입니다 1에서 0 사이의 값이며 0에 가까울수록 투명합니다
    strokeStyle: 'solid', // 선의 스타일입니다
    endArrow: true
});

// 클립보드로 경로 복사
function copyToClipboard() {
    var val = route_node_id.toString();
    var t = document.createElement("textarea");
    document.body.appendChild(t);
    t.value = val;
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);

    alert('클립보드에 복사되었습니다.');
}
        
// 운전자 특성 확인
function viewDriverCoef(driver){		
    (function () {
        $.getJSON(naviAPI, {
            type: "getDriverCoef",
            driver: driver
        }).done(function (data) {
            var parsedJson = JSON.parse(JSON.stringify(data));
            var text = "<" + driver +
                    " 운전자 정보>" + "\n" + "어린이 보호 구역 : " + parsedJson['children_coef'] + "\n" + "신호등 : " + parsedJson['signal_coef'] + "\n"
                    + "단속카메라 : " + parsedJson['enforce_coef'] + "\n" + "교차로 : "+ parsedJson['cross_coef'] + "\n" + "도로 차선수 : " + parsedJson['road_width_coef'] + "\n"
                    + "주행거리 : " + (parseFloat(parsedJson['driving_distance']) / 1000).toFixed(1) + "km";
            alert(text);
        });
    })();
}

// 운전자 특성 초기화
function resetDriverCoef(driver){		
    if(confirm(driver + " 운전자 특성을 초기화 하시겠습니까?")){
        (function () {
            $.getJSON(naviAPI, {
                type: "resetDriverCoef",
                driver: driver
            }).done(function (data) {
                var parsedJson = JSON.parse(JSON.stringify(data));
                alert('운전자 특성이 초기화 되었습니다.');
            });
        })();
    }
}

// 주행 완료
function endRoute(driver){
    if(confirm(driver + " 운전자 특성을 반영 하시겠습니까?")){
        (function () {
            $.getJSON(naviAPI, {
                type: "analyzeRoute",
                end: 'true',
                route: route_node_id.toString(),
                time: currentDate.getHours(),
                driver: driver
            }).done(function (data) {
                var parsedJson = JSON.parse(JSON.stringify(data));
                if(parsedJson['result'] == 'ok'){
                    alert("운전자의 주행 패턴 분석 결과가 반영되었습니다.");
                    clearRoute();
                }
            });
        })();
    }
}

// 경로 초기화
function clearRoute(){
    for(var i=0; i<route_markers.length; i++){
        route_markers[i].setMap(null);
    }

    for(var i=0; i<target_markers.length; i++){
        target_markers[i].setMap(null);
    }

    for(var i=0; i<adjacent_polylines.length; i++){
        adjacent_polylines[i].setMap(null);
    }
    
    dijkstraLine.setMap(null);
    dijkstraLinePath = []
    routeLine.setMap(null);
    routeLinePath = [];

    adjacent_polylines = [];
    route_markers = [];
    route_node_id = [];

    document.getElementById('children_analyze').innerHTML = '-';
    document.getElementById('signal_analyze').innerHTML = '-';
    document.getElementById('cross_analyze').innerHTML = '-';
    document.getElementById('enforce_analyze').innerHTML = '-';
    document.getElementById('road_width_analyze').innerHTML = '-';

    document.getElementById('children_analyze_minimum').innerHTML = '-';
    document.getElementById('signal_analyze_minimum').innerHTML = '-';
    document.getElementById('cross_analyze_minimum').innerHTML = '-';
    document.getElementById('enforce_analyze_minimum').innerHTML = '-';
    document.getElementById('road_width_analyze_minimum').innerHTML = '-';

    daum.maps.event.addListener(map, 'click', mapRouteClickListner);
}

// 시간 더하기/빼기
function adjustHour(buttonType) {
    if (buttonType == '+') {
        diffHour++;
    } else if (buttonType == '-') {
        diffHour--;
    }
}

// 어린이 보호 구역 위치 표시하기
function getFeatureChildren(buttonType) {
    var isView = 1;

    if(buttonType == 0){
        if(document.getElementById("markerChildrenCheckbox_1").checked){
            isView = 1;
        }else{
            isView = 0;
        }
    }else if(buttonType == 1){
        if(document.getElementById("markerChildrenCheckbox_2").checked){
            isView = 1;
        }else{
            isView = 0;
        }
    }

    if(isView == 1){
        (function () {
            $.getJSON(naviAPI, {
                type: "getFeature",
                feature_type: "children"
            }).done(function (data) {
                lat1 = [];
                lng1 = [];
    
                var parsedJson = JSON.parse(JSON.stringify(data));
    
                featureMarkersChildren = [];
    
                var len = Object.keys(parsedJson).length - 1;
                for (var i = 0; i < len; i++) {
                    lat1.push(parsedJson[i.toString()]["lat"]);
                    lng1.push(parsedJson[i.toString()]["lng"]);
    
                    var imageSrc = './image/children.png', // 마커이미지의 주소입니다    
                        imageSize = new daum.maps.Size(30, 30), // 마커이미지의 크기입니다
                        imageOption = {}; // 마커이미지의 옵션입니다. 마커의 좌표와 일치시킬 이미지 안에서의 좌표를 설정합니다.
    
                    // 마커의 이미지정보를 가지고 있는 마커이미지를 생성합니다
                    var markerImage = new daum.maps.MarkerImage(imageSrc, imageSize, imageOption),
                        markerPosition = new daum.maps.LatLng(lat1[i], lng1[i]); // 마커가 표시될 위치입니다
    
                    // 마커를 생성합니다
                    var marker = new daum.maps.Marker({
                        position: markerPosition,
                        image: markerImage, // 마커이미지 설정 
                        clickable: false
                    });
    
                    // 마커가 지도 위에 표시되도록 설정합니다
                    marker.setMap(map);
    
                    featureMarkersChildren.push(marker);
                }
            });
        })();
    }else{
        for(var i = 0; i < featureMarkersChildren.length; i++){
            featureMarkersChildren[i].setMap(null);
        }
        featureMarkersChildren = [];
    }
}

// 신호등 위치 표시하기
function getFeatureSignal(buttonType) {
    var isView = 1;

    if(buttonType == 0){
        if(document.getElementById("markerSignalCheckbox_1").checked){
            isView = 1;
        }else{
            isView = 0;
        }
    }else if(buttonType == 1){
        if(document.getElementById("markerSignalCheckbox_2").checked){
            isView = 1;
        }else{
            isView = 0;
        }
    }

    if(isView == 1){
        (function () {
            $.getJSON(naviAPI, {
                type: "getFeature",
                feature_type: "signal"
            }).done(function (data) {
                lat1 = [];
                lng1 = [];

                featureMarkersSignal = [];

                var parsedJson = JSON.parse(JSON.stringify(data));

                var len = Object.keys(parsedJson).length - 1;
                for (var i = 0; i < len; i++) {
                    lat1.push(parsedJson[i.toString()]["lat"]);
                    lng1.push(parsedJson[i.toString()]["lng"]);

                    var imageSrc = './image/signal.png', // 마커이미지의 주소입니다    
                        imageSize = new daum.maps.Size(30, 30), // 마커이미지의 크기입니다
                        imageOption = {}; // 마커이미지의 옵션입니다. 마커의 좌표와 일치시킬 이미지 안에서의 좌표를 설정합니다.

                    // 마커의 이미지정보를 가지고 있는 마커이미지를 생성합니다
                    var markerImage = new daum.maps.MarkerImage(imageSrc, imageSize, imageOption),
                        markerPosition = new daum.maps.LatLng(lat1[i], lng1[i]); // 마커가 표시될 위치입니다

                    // 마커를 생성합니다
                    var marker = new daum.maps.Marker({
                        position: markerPosition,
                        image: markerImage, // 마커이미지 설정 
                        clickable: false
                    });

                    // 마커가 지도 위에 표시되도록 설정합니다
                    marker.setMap(map);

                    featureMarkersSignal.push(marker);
                }
            });
        })();
    }else{
        for(var i = 0; i < featureMarkersSignal.length; i++){
            featureMarkersSignal[i].setMap(null);
        }
        featureMarkersSignal = [];
    }
}

// 단속카메라 위치 표시하기
function getFeatureEnforce(buttonType) {
    var isView = 1;

    if(buttonType == 0){
        if(document.getElementById("markerEnforceCheckbox_1").checked){
            isView = 1;
        }else{
            isView = 0;
        }
    }else if(buttonType == 1){
        if(document.getElementById("markerEnforceCheckbox_2").checked){
            isView = 1;
        }else{
            isView = 0;
        }
    }

    if(isView == 1){
        (function () {
            $.getJSON(naviAPI, {
                type: "getFeature",
                feature_type: "enforce"
            }).done(function (data) {
                lat1 = [];
                lng1 = [];

                featureMarkersEnforce = [];

                var parsedJson = JSON.parse(JSON.stringify(data));

                var len = Object.keys(parsedJson).length - 1;
                for (var i = 0; i < len; i++) {
                    lat1.push(parsedJson[i.toString()]["lat"]);
                    lng1.push(parsedJson[i.toString()]["lng"]);

                    var imageSrc = './image/enforce.png', // 마커이미지의 주소입니다    
                        imageSize = new daum.maps.Size(30, 30), // 마커이미지의 크기입니다
                        imageOption = {}; // 마커이미지의 옵션입니다. 마커의 좌표와 일치시킬 이미지 안에서의 좌표를 설정합니다.

                    // 마커의 이미지정보를 가지고 있는 마커이미지를 생성합니다
                    var markerImage = new daum.maps.MarkerImage(imageSrc, imageSize, imageOption),
                        markerPosition = new daum.maps.LatLng(lat1[i], lng1[i]); // 마커가 표시될 위치입니다

                    // 마커를 생성합니다
                    var marker = new daum.maps.Marker({
                        position: markerPosition,
                        image: markerImage, // 마커이미지 설정 
                        clickable: false
                    });

                    // 마커가 지도 위에 표시되도록 설정합니다
                    marker.setMap(map);

                    featureMarkersEnforce.push(marker);
                }
            });
        })();
    }else{
        for(var i = 0; i < featureMarkersEnforce.length; i++){
            featureMarkersEnforce[i].setMap(null);
        }
        featureMarkersEnforce = [];
    }
}

// 시계 표시하기
function printClock() {
    currentDate = new Date();
    currentDate.setHours(new Date().getHours() + diffHour);
    var clock = document.getElementById("clock"); // 출력할 장소 선택
    var calendar = currentDate.getFullYear() + "-" + (currentDate.getMonth() + 1) + "-" + currentDate.getDate() // 현재 날짜
    var amPm = 'AM'; // 초기값 AM
    var currentHours = addZeros(currentDate.getHours(), 2);
    var currentMinute = addZeros(currentDate.getMinutes(), 2);
    var currentSeconds = addZeros(currentDate.getSeconds(), 2);

    if (currentHours >= 12) { // 시간이 12보다 클 때 PM으로 세팅, 12를 빼줌
        amPm = 'PM';
        if (currentHours != 12) currentHours = addZeros(currentHours - 12, 2);
    }

    clockDot = (clockDot == ":") ? " " : ":";
    clock.innerHTML = currentHours + clockDot + currentMinute + " <span style='font-size:25px;'>" + amPm + "</span>"; //날짜를 출력해 줌

    setTimeout("printClock()", 1000); // 0.5초마다 printClock() 함수 호출
}

function addZeros(num, digit) { // 자릿수 맞춰주기
    var zero = '';
    num = num.toString();
    if (num.length < digit) {
        for (i = 0; i < digit - num.length; i++) {
            zero += '0';
        }
    }
    return zero + num;
}


// 시계 실행
printClock();

// 경로 분석 모드 실행
routeAnalyze();


// 서버에서 경로 받아오기
function getRoute() {
    (function () {
        $.getJSON(naviAPI, {
            type: "findRoute",
            start: document.getElementById("startNode").value,
            finish: document.getElementById("finishNode").value,
            time: currentDate.getHours(),
            driver: (document.getElementsByName("driverNameRoute")[0].checked) ? document.getElementsByName("driverNameRoute")[0].value :
                document.getElementsByName("driverNameRoute")[1].value
        }).done(function (data) {
            lat1 = [];
            lng1 = [];
            lat2 = [];
            lng2 = [];

            var parsedJson = JSON.parse(JSON.stringify(data));

            lengthMinimum = Object.keys(parsedJson["dijkstra"]).length - 3;
            for (var i = 0; i < lengthMinimum; i++) {
                lat1.push(parsedJson["dijkstra"][i.toString()]["lat"]);
                lng1.push(parsedJson["dijkstra"][i.toString()]["lng"]);
            }

            lengthRecommend = Object.keys(parsedJson["heuristic"]).length - 3;
            for (var i = 0; i < lengthRecommend; i++) {
                lat2.push(parsedJson["heuristic"][i.toString()]["lat"]);
                lng2.push(parsedJson["heuristic"][i.toString()]["lng"]);
            }

            document.getElementById('minimumResult').innerHTML = (parsedJson["dijkstra"]['result']['dist'] / 1000).toFixed(
                1) + ' km / ' + (Math.round(parsedJson["dijkstra"]['result']['time'] / 60)) + "분 ";
            document.getElementById('recommendResult').innerHTML = (parsedJson["heuristic"]['result']['dist'] / 1000).toFixed(
                1) + ' km / ' + (Math.round(parsedJson["heuristic"]['result']['time'] / 60)) + "분 ";

            document.getElementById('children_recommend').innerHTML = parsedJson["heuristic"]['feature']['children_zone_count'];
            document.getElementById('signal_recommend').innerHTML = parsedJson["heuristic"]['feature']['signal_count'];
            document.getElementById('cross_recommend').innerHTML = parsedJson["heuristic"]['feature']['cross_count'];
            document.getElementById('enforce_recommend').innerHTML = parsedJson["heuristic"]['feature']['enforce_count'];
            document.getElementById('road_width_recommend').innerHTML = parsedJson["heuristic"]['feature']['road_width'];

            document.getElementById('children_minimum').innerHTML = parsedJson["dijkstra"]['feature']['children_zone_count'];
            document.getElementById('signal_minimum').innerHTML = parsedJson["dijkstra"]['feature']['signal_count'];
            document.getElementById('cross_minimum').innerHTML = parsedJson["dijkstra"]['feature']['cross_count'];
            document.getElementById('enforce_minimum').innerHTML = parsedJson["dijkstra"]['feature']['enforce_count'];
            document.getElementById('road_width_minimum').innerHTML = parsedJson["dijkstra"]['feature']['road_width'];

            lengthRecommendFeatures = Object.keys(parsedJson["heuristic"]['featureLocation']).length;
            for(var i=0; i<featureOnRecommendRoute.length; i++){
                featureOnRecommendRoute[i].setMap(null);
            }
            featureOnRecommendRoute = [];
            for(var i=0; i<lengthRecommendFeatures; i++){
                var imageSrc = './image/' + parsedJson["heuristic"]['featureLocation'][i.toString()]['type'] + '.png', // 마커이미지의 주소입니다    
                    imageSize = new daum.maps.Size(30, 30), // 마커이미지의 크기입니다
                    imageOption = {}; // 마커이미지의 옵션입니다. 마커의 좌표와 일치시킬 이미지 안에서의 좌표를 설정합니다.

                // 마커의 이미지정보를 가지고 있는 마커이미지를 생성합니다
                var markerImage = new daum.maps.MarkerImage(imageSrc, imageSize, imageOption),
                    markerPosition = new daum.maps.LatLng(parsedJson["heuristic"]['featureLocation'][i.toString()]['lat'], parsedJson["heuristic"]['featureLocation'][i.toString()]['lng']); // 마커가 표시될 위치입니다

                // 마커를 생성합니다
                var marker = new daum.maps.Marker({
                    position: markerPosition,
                    image: markerImage, // 마커이미지 설정 
                    clickable: false
                });

                // 마커가 지도 위에 표시되도록 설정합니다
                marker.setMap(map);

                featureOnRecommendRoute.push(marker);
            }

            lengthMinimumFeatures = Object.keys(parsedJson["dijkstra"]['featureLocation']).length;
            for(var i=0; i<featureOnMinimumRoute.length; i++){
                featureOnMinimumRoute[i].setMap(null);
            }
            featureOnMinimumRoute = [];
            for(var i=0; i<lengthMinimumFeatures; i++){
                var imageSrc = './image/' + parsedJson["dijkstra"]['featureLocation'][i.toString()]['type'] + '.png', // 마커이미지의 주소입니다    
                    imageSize = new daum.maps.Size(30, 30), // 마커이미지의 크기입니다
                    imageOption = {}; // 마커이미지의 옵션입니다. 마커의 좌표와 일치시킬 이미지 안에서의 좌표를 설정합니다.

                // 마커의 이미지정보를 가지고 있는 마커이미지를 생성합니다
                var markerImage = new daum.maps.MarkerImage(imageSrc, imageSize, imageOption),
                    markerPosition = new daum.maps.LatLng(parsedJson["dijkstra"]['featureLocation'][i.toString()]['lat'], parsedJson["dijkstra"]['featureLocation'][i.toString()]['lng']); // 마커가 표시될 위치입니다

                // 마커를 생성합니다
                var marker = new daum.maps.Marker({
                    position: markerPosition,
                    image: markerImage, // 마커이미지 설정 
                    clickable: false
                });

                // 마커가 지도 위에 표시되도록 설정합니다
                marker.setMap(null);

                featureOnMinimumRoute.push(marker);
            }

            zoomRecommend();
        });
    })();
}

// 경로 탐색 모드
function routeFind(){
    document.getElementById('findMode').style.display = 'block';
    document.getElementById('analyzeMode').style.display = 'none';
    document.getElementById('routeTab').style.display = 'block';
    document.getElementById('analyzeTab').style.display = 'none';
    document.getElementById('searchResult').innerHTML = '검색결과';

    document.getElementById('recommendResult').innerHTML = '-';
    document.getElementById('minimumResult').innerHTML = '-';

    document.getElementById('children_recommend').innerHTML = '-';
    document.getElementById('signal_recommend').innerHTML = '-';
    document.getElementById('cross_recommend').innerHTML = '-';
    document.getElementById('enforce_recommend').innerHTML = '-';
    document.getElementById('road_width_recommend').innerHTML = '-';

    document.getElementById('children_minimum').innerHTML = '-';
    document.getElementById('signal_minimum').innerHTML = '-';
    document.getElementById('cross_minimum').innerHTML = '-';
    document.getElementById('enforce_minimum').innerHTML = '-';
    document.getElementById('road_width_minimum').innerHTML = '-';

    document.getElementById('routeAnalyzeMode').style.backgroundColor = '#dedede';
    document.getElementById('routeAnalyzeMode').style.color = '#000';
    document.getElementById('routeFindMode').style.backgroundColor = '#002c5f';
    document.getElementById('routeFindMode').style.color = '#fff';

    document.getElementById('startNode').value = '';
    document.getElementById('finishNode').value = '';

    clearRoute();

    mapContainer = document.getElementById('map'), // 지도를 표시할 div 
    mapOption = {
        center: new daum.maps.LatLng(37.199370, 127.097028), // 지도의 중심좌표
        level: 7 // 지도의 확대 레벨
    };

    map = new daum.maps.Map(mapContainer, mapOption); // 지도를 생성합니다

    // 어린이 보호구역, 단속카메라 마커 표시
    getFeatureChildren(1);
    getFeatureEnforce(1);
    getFeatureSignal(1);

    var startSrc = 'http://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png', // 출발 마커이미지의 주소입니다    
        startSize = new daum.maps.Size(50, 45), // 출발 마커이미지의 크기입니다 
        startOption = {
            offset: new daum.maps.Point(15, 43) // 출발 마커이미지에서 마커의 좌표에 일치시킬 좌표를 설정합니다 (기본값은 이미지의 가운데 아래입니다)
        };

    // 출발 마커 이미지를 생성합니다
    var startImage = new daum.maps.MarkerImage(startSrc, startSize, startOption);

    var startDragSrc = 'http://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_drag.png', // 출발 마커의 드래그 이미지 주소입니다    
        startDragSize = new daum.maps.Size(50, 64), // 출발 마커의 드래그 이미지 크기입니다 
        startDragOption = {
            offset: new daum.maps.Point(15, 54) // 출발 마커의 드래그 이미지에서 마커의 좌표에 일치시킬 좌표를 설정합니다 (기본값은 이미지의 가운데 아래입니다)
        };

    // 출발 마커의 드래그 이미지를 생성합니다
    var startDragImage = new daum.maps.MarkerImage(startDragSrc, startDragSize, startDragOption);

    // 출발 마커가 표시될 위치입니다 
    var startPosition = new daum.maps.LatLng(37.199370, 127.097028);

    // 출발 마커를 생성합니다
    startMarker = new daum.maps.Marker({
        map: map, // 출발 마커가 지도 위에 표시되도록 설정합니다
        position: startPosition,
        draggable: true, // 출발 마커가 드래그 가능하도록 설정합니다
        image: startImage, // 출발 마커이미지를 설정합니다
        zIndex: 100
    });

    // 출발 마커에 dragstart 이벤트를 등록합니다
    daum.maps.event.addListener(startMarker, 'dragstart', function () {
        // 출발 마커의 드래그가 시작될 때 마커 이미지를 변경합니다
        startMarker.setImage(startDragImage);
    });

    // 출발 마커에 dragend 이벤트를 등록합니다
    daum.maps.event.addListener(startMarker, 'dragend', function () {
        // 출발 마커의 드래그가 종료될 때 마커 이미지를 원래 이미지로 변경합니다
        startMarker.setImage(startImage);

        (function () {
            $.getJSON(naviAPI, {
                type: "findNode",
                lat: startMarker.getPosition().getLat(),
                lng: startMarker.getPosition().getLng()
            }).done(function (data) {
                var parsedJson = JSON.parse(JSON.stringify(data));

                var length = Object.keys(parsedJson).length;

                var close_node = parsedJson["node"];
                var close_lat = parsedJson["lat"];
                var close_lng = parsedJson["lng"];

                document.getElementById("startNode").value = close_node;

                startMarker.setPosition(new daum.maps.LatLng(close_lat, close_lng));

                getRoute();
            });
        })();
    });

    var arriveSrc = 'http://t1.daumcdn.net/localimg/localimages/07/mapapidoc/blue_b.png', // 도착 마커이미지 주소입니다    
        arriveSize = new daum.maps.Size(50, 45), // 도착 마커이미지의 크기입니다 
        arriveOption = {
            offset: new daum.maps.Point(15, 43) // 도착 마커이미지에서 마커의 좌표에 일치시킬 좌표를 설정합니다 (기본값은 이미지의 가운데 아래입니다)
        };

    // 도착 마커 이미지를 생성합니다
    var arriveImage = new daum.maps.MarkerImage(arriveSrc, arriveSize, arriveOption);

    var arriveDragSrc = 'http://t1.daumcdn.net/localimg/localimages/07/mapapidoc/blue_drag.png', // 도착 마커의 드래그 이미지 주소입니다    
        arriveDragSize = new daum.maps.Size(50, 64), // 도착 마커의 드래그 이미지 크기입니다 
        arriveDragOption = {
            offset: new daum.maps.Point(15, 54) // 도착 마커의 드래그 이미지에서 마커의 좌표에 일치시킬 좌표를 설정합니다 (기본값은 이미지의 가운데 아래입니다)
        };

    // 도착 마커의 드래그 이미지를 생성합니다
    var arriveDragImage = new daum.maps.MarkerImage(arriveDragSrc, arriveDragSize, arriveDragOption);

    // 도착 마커가 표시될 위치입니다 
    var arrivePosition = new daum.maps.LatLng(37.19682376499981, 127.08819945947645);

    // 도착 마커를 생성합니다 
    arriveMarker = new daum.maps.Marker({
        map: map, // 도착 마커가 지도 위에 표시되도록 설정합니다
        position: arrivePosition,
        draggable: true, // 도착 마커가 드래그 가능하도록 설정합니다
        image: arriveImage, // 도착 마커이미지를 설정합니다
        zIndex: 100
    });

    // 도착 마커에 dragstart 이벤트를 등록합니다
    daum.maps.event.addListener(arriveMarker, 'dragstart', function () {
        // 도착 마커의 드래그가 시작될 때 마커 이미지를 변경합니다
        arriveMarker.setImage(arriveDragImage);
    });

    // 도착 마커에 dragend 이벤트를 등록합니다
    daum.maps.event.addListener(arriveMarker, 'dragend', function () {
        // 도착 마커의 드래그가 종료될 때 마커 이미지를 원래 이미지로 변경합니다
        arriveMarker.setImage(arriveImage);

        (function () {
            $.getJSON(naviAPI, {
                type: "findNode",
                lat: arriveMarker.getPosition().getLat(),
                lng: arriveMarker.getPosition().getLng()
            }).done(function (data) {
                var parsedJson = JSON.parse(JSON.stringify(data));

                var length = Object.keys(parsedJson).length;

                var close_node = parsedJson["node"];
                var close_lat = parsedJson["lat"];
                var close_lng = parsedJson["lng"];

                document.getElementById("finishNode").value = close_node;

                arriveMarker.setPosition(new daum.maps.LatLng(close_lat, close_lng));

                getRoute();
            });
        })();
    });
}

// 경로 분석 모드
function routeAnalyze(){
    document.getElementById('findMode').style.display = 'none';
    document.getElementById('analyzeMode').style.display = 'block';
    document.getElementById('routeTab').style.display = 'none';
    document.getElementById('analyzeTab').style.display = 'block';
    document.getElementById('searchResult').innerHTML = '분석결과';

    document.getElementById('children_analyze').innerHTML = '-';
    document.getElementById('signal_analyze').innerHTML = '-';
    document.getElementById('cross_analyze').innerHTML = '-';
    document.getElementById('enforce_analyze').innerHTML = '-';
    document.getElementById('road_width_analyze').innerHTML = '-';

    document.getElementById('children_analyze_minimum').innerHTML = '-';
    document.getElementById('signal_analyze_minimum').innerHTML = '-';
    document.getElementById('cross_analyze_minimum').innerHTML = '-';
    document.getElementById('enforce_analyze_minimum').innerHTML = '-';
    document.getElementById('road_width_analyze_minimum').innerHTML = '-';

    document.getElementById('routeAnalyzeMode').style.backgroundColor = '#002c5f';
    document.getElementById('routeAnalyzeMode').style.color = '#fff';
    document.getElementById('routeFindMode').style.backgroundColor = '#dedede';
    document.getElementById('routeFindMode').style.color = '#000';

    route_markers = [];

    mapContainer = document.getElementById('map'), // 지도를 표시할 div 
    mapOption = {
        center: new daum.maps.LatLng(37.199370, 127.097028), // 지도의 중심좌표
        level: 7 // 지도의 확대 레벨
    };

    map = new daum.maps.Map(mapContainer, mapOption); // 지도를 생성합니다

    var iwContent = '<div style="padding:5px; width:220px; font-size:13px;">지도를 클릭하여 경로만들기를 시작하세요.</div>', // 인포윈도우에 표출될 내용으로 HTML 문자열이나 document element가 가능합니다
        iwPosition = new daum.maps.LatLng(37.199370, 127.097028), //인포윈도우 표시 위치입니다
        iwRemoveable = true; // removeable 속성을 ture 로 설정하면 인포윈도우를 닫을 수 있는 x버튼이 표시됩니다

    // 인포윈도우를 생성하고 지도에 표시합니다
    infoWindow = new daum.maps.InfoWindow({
        map: map, // 인포윈도우가 표시될 지도
        position : iwPosition, 
        content : iwContent,
        zIndex : 100
    });

    // 어린이 보호구역, 단속카메라 마커 표시
    getFeatureChildren(0);
    getFeatureEnforce(0);
    getFeatureSignal(0);

    // 지도에 클릭 이벤트를 등록합니다
    // 지도를 클릭하면 선 그리기가 시작됩니다 그려진 선이 있으면 지우고 다시 그립니다
    daum.maps.event.addListener(map, 'click', mapRouteClickListner);
}

function makeNextTarget(nowLat, nowLng){
    infoWindow.close();

    (function () {
        $.getJSON(naviAPI, {
            type: "findNode",
            lat: nowLat,
            lng: nowLng
        }).done(function (data) {
            var parsedJson = JSON.parse(JSON.stringify(data));

            var length = Object.keys(parsedJson).length;

            var close_node = parsedJson["node"];
            var close_lat = parsedJson["lat"];
            var close_lng = parsedJson["lng"];

            if(route_markers.length > 0) route_markers[route_markers.length - 1].setMap(null);

            var marker = new daum.maps.Marker({
                map: map, // 마커를 표시할 지도
                position: new daum.maps.LatLng(close_lat, close_lng), // 마커를 표시할 위치
                title: '현재위치', // 마커의 타이틀, 마커에 마우스를 올리면 타이틀이 표시됩니다
                image: nexoMarkerImage // 마커 이미지
            });

            // 마커가 지도 위에 표시되도록 설정합니다
            marker.setMap(map);

            map.panTo(marker.getPosition());

            // 생성된 마커를 배열에 추가합니다
            route_markers.push(marker);
            
            // 궤적 그리기
            routeLinePath.push(new daum.maps.LatLng(close_lat, close_lng));
            
            routeLine.setMap(null); 
            routeLine.setPath(routeLinePath);
            routeLine.setMap(map); 

            var adjacent_length = Object.keys(parsedJson["adjacent"]).length;
            
            // 기존 타겟 라인 제거
            for(var i=0; i<adjacent_polylines.length; i++){
                adjacent_polylines[i].setMap(null);
            }

            adjacent_polylines = [];

            // 기존 타겟 마커 제거
            for(var i=0; i<target_markers.length; i++){
                target_markers[i].setMap(null);
            }

            target_markers = [];

            for(var i=0; i<adjacent_length; i++){
                var adjacent_lat = parsedJson["adjacent"][i]['lat'];
                var adjacent_lng = parsedJson["adjacent"][i]['lng'];

                // 선을 구성하는 좌표 배열입니다. 이 좌표들을 이어서 선을 표시합니다
                var linePath = [
                    new daum.maps.LatLng(close_lat, close_lng),
                    new daum.maps.LatLng(adjacent_lat, adjacent_lng)
                ];

                // 지도에 표시할 선을 생성합니다
                var polyline = new daum.maps.Polyline({
                    path: linePath, // 선을 구성하는 좌표배열 입니다
                    strokeWeight: 5, // 선의 두께 입니다
                    strokeColor: 'orange', // 선의 색깔입니다
                    strokeOpacity: 0.7, // 선의 불투명도 입니다 1에서 0 사이의 값이며 0에 가까울수록 투명합니다
                    strokeStyle: 'solid', // 선의 스타일입니다
                    endArrow: true
                });

                // 지도에 선을 표시합니다 
                polyline.setMap(map); 

                adjacent_polylines.push(polyline);

                var targetMarker = new daum.maps.Marker({
                    map: map, // 마커를 표시할 지도
                    position: new daum.maps.LatLng(adjacent_lat, adjacent_lng), // 마커를 표시할 위치
                    title: '다음위치', // 마커의 타이틀, 마커에 마우스를 올리면 타이틀이 표시됩니다
                    image: yellowMarkerImage // 마커 이미지
                });

                // 마커가 지도 위에 표시되도록 설정합니다
                targetMarker.setMap(map);

                // 생성된 마커를 배열에 추가합니다
                target_markers.push(targetMarker);
            }

            // 노드 번호 저장
            if(route_node_id[route_node_id.length - 1] != close_node){
                route_node_id.push(close_node);

                (function () {
                    $.getJSON(naviAPI, {
                        type: "analyzeRoute",
                        route: route_node_id.toString(),
                        time: currentDate.getHours(),
                        end: 'false'
                    }).done(function (data) {
                        var parsedJson = JSON.parse(JSON.stringify(data));

                        document.getElementById('children_analyze').innerHTML = parsedJson["driver"]['feature']['children_zone_count'];
                        document.getElementById('signal_analyze').innerHTML = parsedJson["driver"]['feature']['signal_count'];
                        document.getElementById('cross_analyze').innerHTML = parsedJson["driver"]['feature']['cross_count'];
                        document.getElementById('enforce_analyze').innerHTML = parsedJson["driver"]['feature']['enforce_count'];
                        document.getElementById('road_width_analyze').innerHTML = parsedJson["driver"]['feature']['road_width'];

                        document.getElementById('children_analyze_minimum').innerHTML = parsedJson["dijkstra"]['feature']['children_zone_count'];
                        document.getElementById('signal_analyze_minimum').innerHTML = parsedJson["dijkstra"]['feature']['signal_count'];
                        document.getElementById('cross_analyze_minimum').innerHTML = parsedJson["dijkstra"]['feature']['cross_count'];
                        document.getElementById('enforce_analyze_minimum').innerHTML = parsedJson["dijkstra"]['feature']['enforce_count'];
                        document.getElementById('road_width_analyze_minimum').innerHTML = parsedJson["dijkstra"]['feature']['road_width'];

                        dijkstraLinePath = []
                        dijkstraLine.setMap(null);

                        var dijkstraLength = Object.keys(parsedJson['dijkstra']['route']).length;

                        for(var i=0; i<dijkstraLength; i++){
                            dijkstraLinePath.push(new daum.maps.LatLng(parsedJson['dijkstra']['route'][i.toString()]['lat'], parsedJson['dijkstra']['route'][i.toString()]['lng']));
                        }

                        dijkstraLine.setPath(dijkstraLinePath);
                        dijkstraLine.setMap(map);
                    });
                })();
            }

            daum.maps.event.removeListener(map, 'click', mapRouteClickListner);

            if(target_markers.length > 0){
                var marker1 = target_markers[0];
                daum.maps.event.addListener(marker1, 'click', function() {
                    makeNextTarget(marker1.getPosition().getLat(), marker1.getPosition().getLng());
                });
            }

            if(target_markers.length > 1){
                var marker2 = target_markers[1];
                daum.maps.event.addListener(marker2, 'click', function() {
                    makeNextTarget(marker2.getPosition().getLat(), marker2.getPosition().getLng());
                });
            }

            if(target_markers.length > 2){
                var marker3 = target_markers[2];
                daum.maps.event.addListener(marker3, 'click', function() {
                    makeNextTarget(marker3.getPosition().getLat(), marker3.getPosition().getLng());
                });
            }

            if(target_markers.length > 3){
                var marker4 = target_markers[3];
                daum.maps.event.addListener(marker4, 'click', function() {
                    makeNextTarget(marker4.getPosition().getLat(), marker4.getPosition().getLng());
                });
            }

            
        });
    })();
}

// 추천 경로 화면에 꽉 차게 보기
function zoomRecommend() {
    var bounds = new daum.maps.LatLngBounds();

    // 선을 구성하는 좌표 배열입니다. 이 좌표들을 이어서 선을 표시합니다
    var linePath2 = [];

    for (var i = 0; i < lat2.length; i++) {
        linePath2.push(new daum.maps.LatLng(lat2[i], lng2[i]));
        bounds.extend(new daum.maps.LatLng(lat2[i], lng2[i]));
    }

    for (var i = 0; i < polylines.length; i++) {
        polylines[i].setMap(null);
    }

    polylines = []

    for (var i = 0; i < featureOnMinimumRoute.length; i++) {
        featureOnMinimumRoute[i].setMap(null);
    }

    for (var i = 0; i < featureOnRecommendRoute.length; i++) {
        featureOnRecommendRoute[i].setMap(map);
    }

    // 지도에 표시할 선을 생성합니다
    var polyline2 = new daum.maps.Polyline({
        path: linePath2, // 선을 구성하는 좌표배열 입니다
        strokeWeight: 5, // 선의 두께 입니다
        strokeColor: 'blue', // 선의 색깔입니다
        strokeOpacity: 0.7, // 선의 불투명도 입니다 1에서 0 사이의 값이며 0에 가까울수록 투명합니다
        strokeStyle: 'solid' // 선의 스타일입니다
    });

    polylines.push(polyline2);

    // 지도에 선을 표시합니다 
    polyline2.setMap(map);

    map.setBounds(bounds);

    startMarker.setPosition(new daum.maps.LatLng(lat2[0], lng2[0]));
    arriveMarker.setPosition(new daum.maps.LatLng(lat2[lat2.length - 1], lng2[lng2.length - 1]));
}

// 최소 시간 경로 화면에 꽉 차게 보기
function zoomMinimum() {
    var bounds = new daum.maps.LatLngBounds();

    // 선을 구성하는 좌표 배열입니다. 이 좌표들을 이어서 선을 표시합니다
    var linePath1 = [];

    for (var i = 0; i < lat1.length; i++) {
        linePath1.push(new daum.maps.LatLng(lat1[i], lng1[i]));
        bounds.extend(new daum.maps.LatLng(lat1[i], lng1[i]));
    }

    for (var i = 0; i < polylines.length; i++) {
        polylines[i].setMap(null);
    }

    polylines = []

    for (var i = 0; i < featureOnMinimumRoute.length; i++) {
        featureOnMinimumRoute[i].setMap(map);
    }

    for (var i = 0; i < featureOnRecommendRoute.length; i++) {
        featureOnRecommendRoute[i].setMap(null);
    }

    // 지도에 표시할 선을 생성합니다
    var polyline1 = new daum.maps.Polyline({
        path: linePath1, // 선을 구성하는 좌표배열 입니다
        strokeWeight: 5, // 선의 두께 입니다
        strokeColor: 'red', // 선의 색깔입니다
        strokeOpacity: 0.7, // 선의 불투명도 입니다 1에서 0 사이의 값이며 0에 가까울수록 투명합니다
        strokeStyle: 'solid' // 선의 스타일입니다
    });

    polylines.push(polyline1);

    // 지도에 선을 표시합니다 
    polyline1.setMap(map);

    map.setBounds(bounds);

    startMarker.setPosition(new daum.maps.LatLng(lat1[0], lng1[0]));
    arriveMarker.setPosition(new daum.maps.LatLng(lat1[lat1.length - 1], lng1[lng1.length - 1]));

}
