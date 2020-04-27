import http.server, math, json, heapq
from urllib.parse import urlparse

# 노드 정보 저장(노드는 1번 부터)
ROAD_INFO = {} # 도로 정보
TRAFFIC_COEFFICIENT = [0] * 5 # 도로/시간별 정체 가중치
DRIVER_COEFF = {}

# 다익스트라
class Dijkstra:
    START = 0
    FINISH = 0
    TYPE = 0
    TIME = 0

    def __init__(self, start, finish, time=None):
        self.START = start
        self.FINISH = finish
        if time != None:
            self.TIME = time

    def implement(self):
        INF = ((1<<63) - 1)//2
        pred = { x:x for x in ROAD_INFO }
        dist = { x:INF for x in ROAD_INFO }
        dist[ self.START ] = 0
        PQ = []
        heapq.heappush(PQ, [dist[ self.START ], self.START])

        while(PQ):
            u = heapq.heappop(PQ)  # u is a tuple [u_dist, u_id]
            u_dist = u[0]
            u_id = u[1]
            if u_dist == dist[u_id]:
                for v in ROAD_INFO[u_id].keys():
                    if v.isnumeric():
                        v_id = v
                        w_uv = ROAD_INFO[u_id][v]['moving_time'][self.TIME]
                        if dist[u_id] +  w_uv < dist[v_id]:
                            dist[v_id] = dist[u_id] + w_uv
                            heapq.heappush(PQ, [dist[v_id], v_id])
                            pred[v_id] = u_id
                    
        st = []
        node = self.FINISH
        while(True):
            st.append(str(node))
            if(node==pred[node]):
                break
            node = pred[node]
        path = st[::-1]
        return path

# 휴리스틱 경로 탐색
class Heuristic:
    TIME = 0
    RESULT = []
    START = 0
    FINISH = 0
    DRIVER = ''

    def __init__(self, start, finish, driver, time=None):
        self.RESULT = []
        self.START = start
        self.FINISH = finish
        self.DRIVER = driver

        if time != None:
            self.TIME = time

    def implement(self):
        self.RESULT.append(self.START)

        visit_count = 0
        visit_yn = [0] * 1000 # 방문 여부 체크
        visit_yn[int(self.START)] = 1

        while True:
            fromNode = self.RESULT[visit_count]
            minimum_cost = ((1<<63) - 1)//2
            minimum_cost_node = 0
            # 가장 cost가 작은 노드를 선택해서 다음으로 방문
            for toNode in ROAD_INFO[fromNode].keys():
                if toNode.isnumeric() and visit_yn[int(toNode)] != 1:
                    # cost를 구하기 위한 최적 경로 탐색
                    d = Dijkstra(toNode, self.FINISH, self.TIME)
                    route = d.implement()

                    road_information = analyzeRoadFeature(route)
                    total_dist, total_time = getTimeAndDistance(route, self.TIME)

                    road_information['cross_count'] += ROAD_INFO[toNode]['cross_yn']
                    road_information['signal_count'] += ROAD_INFO[fromNode][toNode]['signal_count']
                    road_information['enforce_count'] += ROAD_INFO[fromNode][toNode]['signal_enforce_count'] + ROAD_INFO[fromNode][toNode]['speed_enforce_count']
                    road_information['children_zone_count'] += ROAD_INFO[fromNode][toNode]['children_zone_count']
                    road_information['road_width'] = (road_information['road_width'] + ROAD_INFO[fromNode][toNode]['road_width']) / 2

                    # 다음 노드의 cost
                    next_cost = ROAD_INFO[fromNode][toNode]['moving_time'][self.TIME] + total_time \
                                + (DRIVER_COEFF[self.DRIVER]['children_coef'] * road_information['children_zone_count'])\
                                + (DRIVER_COEFF[self.DRIVER]['signal_coef'] * road_information['signal_count'])\
                                + (DRIVER_COEFF[self.DRIVER]['cross_coef'] * road_information['cross_count'])\
                                + (DRIVER_COEFF[self.DRIVER]['enforce_coef'] * road_information['enforce_count'])\
                                - (DRIVER_COEFF[self.DRIVER]['road_width_coef'] * road_information['road_width'])

                    # cost가 최저인 노드를 선택함
                    if minimum_cost > next_cost:
                        minimum_cost = next_cost
                        minimum_cost_node = toNode

            # 모든 방향의 노드가 이미 방문한 노드일 경우
            if minimum_cost_node != 0:
                self.RESULT.append(minimum_cost_node)
                visit_yn[int(minimum_cost_node)] = 1
                visit_count += 1
            else:
                self.RESULT.pop()
                visit_count -= 1

            # 도착했을 경우
            if int(minimum_cost_node) == int(self.FINISH):
                return self.RESULT

# 위도/경도 거리 계산
def getDistance(origin, destination):
    lat1, lon1 = origin
    lat2, lon2 = destination
    radius = 6371000 # m
    dlat = math.radians(lat2-lat1)
    dlon = math.radians(lon2-lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    d = radius * c
    return round(d, 1)

# 위도/경도 각도 계산
def getDegree(pointA, pointB):
    lat1 = math.radians(pointA[0])
    lat2 = math.radians(pointB[0])

    diffLong = math.radians(pointB[1] - pointA[1])

    x = math.sin(diffLong) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1)
            * math.cos(lat2) * math.cos(diffLong))

    initial_bearing = math.degrees(math.atan2(x, y))
    compass_bearing = (initial_bearing + 360) % 360

    return round(compass_bearing, 2)

# 초기화 함수
def init():
    # 노드 위도/경도 정보 불러오기
    f = open("./data/latlng.dat", 'r')
    while True:
        line = f.readline().rstrip('\n')
        if not line:
            break
        node_info = line.split("\t")
        ROAD_INFO[node_info[0]] = {}
        ROAD_INFO[node_info[0]]['lat'] = float(node_info[1])
        ROAD_INFO[node_info[0]]['lng'] = float(node_info[2])
    f.close()

    # 간선 정보 불러오기 / 거리 / 각도 계산하기
    f = open("./data/edge.dat", 'r')
    while True:
        line = f.readline().rstrip('\n')
        if not line:
            break
        edge_info = line.split("\t")
        one_edge = ROAD_INFO[edge_info[0]]
        from_latlng = [ROAD_INFO[edge_info[0]]['lat'], ROAD_INFO[edge_info[0]]['lng']]

        for i in range(1, len(edge_info)):
            information = {}
            if edge_info[i] != '':
                to_latlng = [ ROAD_INFO[edge_info[i]]['lat'], ROAD_INFO[edge_info[i]]['lng'] ]
                information['distance'] = getDistance(from_latlng, to_latlng)
                information['degree'] = getDegree(from_latlng, to_latlng)
                one_edge[edge_info[i]] = information
        ROAD_INFO[edge_info[0]] = one_edge
    f.close()

    # 노드 특성 정보 불러오기
    f = open("./data/node_feature.dat", 'r')
    while True:
        line = f.readline().rstrip('\n')
        if not line:
            break
        node_info = line.split("\t")
        ROAD_INFO[node_info[0].rstrip(' ')]['cross_yn'] = int(node_info[1])

    f.close()

    # 간선 특성 정보 불러오기
    f = open("./data/edge_feature.dat", 'r')
    while True:
        line = f.readline().rstrip('\n')
        if not line:
            break
        edge_info = line.split("\t")
        ROAD_INFO[edge_info[0].rstrip(' ')][edge_info[1].rstrip(' ')]['signal_enforce_count'] = int(edge_info[2])
        ROAD_INFO[edge_info[0].rstrip(' ')][edge_info[1].rstrip(' ')]['signal_count'] = int(edge_info[3])
        ROAD_INFO[edge_info[0].rstrip(' ')][edge_info[1].rstrip(' ')]['road_width'] = float(edge_info[4])
        ROAD_INFO[edge_info[0].rstrip(' ')][edge_info[1].rstrip(' ')]['speed_enforce_count'] = int(edge_info[5])
        ROAD_INFO[edge_info[0].rstrip(' ')][edge_info[1].rstrip(' ')]['children_zone_count'] = int(edge_info[6])

    f.close()

    # 도로/시간별 정체 가중치
    f = open("./data/traffic_coef.dat", 'r')
    for i in range(0, 5):
        line = f.readline().rstrip('\n')
        TRAFFIC_COEFFICIENT[i] = list(map(float, line.split("\t")))

    f.close()

    # 운전자 특성 계수
    f = open("./data/driver_coef.dat", 'r')
    while True:
        line = f.readline().rstrip('\n')
        if not line:
            break
        driver_info = line.split("\t")
        DRIVER_COEFF[driver_info[0]] = {}
        DRIVER_COEFF[driver_info[0]]['children_coef'] = float(driver_info[1])
        DRIVER_COEFF[driver_info[0]]['signal_coef'] = float(driver_info[2])
        DRIVER_COEFF[driver_info[0]]['cross_coef'] = float(driver_info[3])
        DRIVER_COEFF[driver_info[0]]['enforce_coef'] = float(driver_info[4])
        DRIVER_COEFF[driver_info[0]]['road_width_coef'] = float(driver_info[5])
        DRIVER_COEFF[driver_info[0]]['driving_distance'] = float(driver_info[6])

    f.close()

    # 패턴 교통 정보 데이터 생성
    makePatternTrafficInfo()

    # 운전자 특성 분석
    applyDriverCoeff()

# 주행경로 도로특성 확인
def analyzeRoadFeature(route):
    fromNode = route[0]
    cross_count = 0
    signal_enforce_count = 0
    signal_count = 0
    road_width = 0
    speed_enforce_count = 0
    children_zone_count = 0
    left_turn_count = 0
    right_turn_count = 0
    total_distance = 0
    for i in range(1, len(route)):
        cross_count += ROAD_INFO[fromNode]['cross_yn']
        signal_enforce_count += ROAD_INFO[fromNode][route[i]]['signal_enforce_count']
        signal_count += ROAD_INFO[fromNode][route[i]]['signal_count']
        road_width += ROAD_INFO[fromNode][route[i]]['road_width'] * ROAD_INFO[fromNode][route[i]]['distance']
        total_distance += ROAD_INFO[fromNode][route[i]]['distance']
        speed_enforce_count += ROAD_INFO[fromNode][route[i]]['speed_enforce_count']
        children_zone_count += ROAD_INFO[fromNode][route[i]]['children_zone_count']
        if i < len(route) - 1:
            from_degree = ROAD_INFO[route[i]][route[i + 1]]['degree']
            to_degree = ROAD_INFO[fromNode][route[i]]['degree']
            degree_difference = (to_degree - from_degree + 360) % 360

            if degree_difference >= 45 and degree_difference <= 135: right_turn_count += 1
            elif degree_difference >= 225 and degree_difference <= 315: left_turn_count += 1

        fromNode = route[i]

    information = {}
    information['cross_count'] = cross_count
    information['signal_count'] = signal_count
    information['road_width'] = round(road_width / (total_distance + 0.000001))
    information['enforce_count'] = (signal_enforce_count + speed_enforce_count)
    information['children_zone_count'] = children_zone_count
    information['left_turn_count'] = left_turn_count
    information['right_turn_count'] = right_turn_count
        
    return information

# 주행경로 도로특성 위치 분석
def getFeatureLocationOnRoute(route):
    fromNode = route[0]
    featureLocationOnRoute = {}
    totalFeatureCount = 0
    for i in range(1, len(route)):
        if ROAD_INFO[fromNode][route[i]]['signal_enforce_count'] > 0 or ROAD_INFO[fromNode][route[i]]['speed_enforce_count'] > 0:
            featureLocationOnRoute[str(totalFeatureCount)] = {'type' : 'enforce', 'lat' : (ROAD_INFO[fromNode]['lat'] + ROAD_INFO[route[i]]['lat']) / 2, 'lng' : (ROAD_INFO[fromNode]['lng'] + ROAD_INFO[route[i]]['lng']) / 2}
            totalFeatureCount += 1
        if ROAD_INFO[fromNode][route[i]]['signal_count'] > 0:
            featureLocationOnRoute[str(totalFeatureCount)] = {'type' : 'signal', 'lat' : (ROAD_INFO[fromNode]['lat'] + ROAD_INFO[route[i]]['lat']) / 2, 'lng' : (ROAD_INFO[fromNode]['lng'] + ROAD_INFO[route[i]]['lng']) / 2}
            totalFeatureCount += 1
        if ROAD_INFO[fromNode][route[i]]['children_zone_count'] > 0:
            featureLocationOnRoute[str(totalFeatureCount)] = {'type' : 'children', 'lat' : (ROAD_INFO[fromNode]['lat'] + ROAD_INFO[route[i]]['lat']) / 2, 'lng' : (ROAD_INFO[fromNode]['lng'] + ROAD_INFO[route[i]]['lng']) / 2}
            totalFeatureCount += 1   

        fromNode = route[i]
       
    return featureLocationOnRoute

# 패턴 교통 정보 데이터 생성
def makePatternTrafficInfo():
    for fromNode in ROAD_INFO.keys():
        if fromNode != 0:
            for toNode in ROAD_INFO[fromNode].keys():
                if toNode.isnumeric():
                    moving_time = {}
                    for time in range(0,24):
                        # 차선별 이동 시간 계산
                        if ROAD_INFO[fromNode][toNode]['road_width'] == 4.0:
                            moving_time[time] = round(ROAD_INFO[fromNode][toNode]['distance'] / 15 * (1 + 3 * TRAFFIC_COEFFICIENT[0][time]), 1)
                        elif ROAD_INFO[fromNode][toNode]['road_width'] == 3.0:
                            moving_time[time] = round(ROAD_INFO[fromNode][toNode]['distance'] / 13 * (1 + 3 * TRAFFIC_COEFFICIENT[1][time]), 1)
                        elif ROAD_INFO[fromNode][toNode]['road_width'] == 2.0:
                            moving_time[time] = round(ROAD_INFO[fromNode][toNode]['distance'] / 11 * (1 + 3 * TRAFFIC_COEFFICIENT[2][time]), 1)
                        elif ROAD_INFO[fromNode][toNode]['road_width'] == 1.0:
                            moving_time[time] = round(ROAD_INFO[fromNode][toNode]['distance'] / 9 * (1 + 3 * TRAFFIC_COEFFICIENT[3][time]), 1)
                        elif ROAD_INFO[fromNode][toNode]['road_width'] == 0.5:
                            moving_time[time] = round(ROAD_INFO[fromNode][toNode]['distance'] / 5 * (1 + 3 * TRAFFIC_COEFFICIENT[4][time]), 1)
                        if ROAD_INFO[toNode]['cross_yn'] == 1: # 교차로일 경우 30초 추가
                            moving_time[time] += 30
                    ROAD_INFO[fromNode][toNode]['moving_time'] = moving_time

# 경로 JSON 출력 함수
def printJSON(result):
    # JSON 인코딩
    jsonString = json.dumps(result)

    # 문자열 반환
    return jsonString

# 가장 가까운 노드 찾아주는 함수
def findClosestNode(node):
    minimum = 9999999
    minimum_idx = 0

    for i in range(1, len(ROAD_INFO.keys())):
        dist = getDistance(node, [ROAD_INFO[str(i)]['lat'], ROAD_INFO[str(i)]['lng']])
        if minimum > dist:
            minimum = dist
            minimum_idx = i

    return str(minimum_idx)

# 경로 소요시간, 거리 계산
def getTimeAndDistance(route, time):
    fromNode = route[0]

    total_dist = 0
    total_time = 0

    for i in range(1, len(route)):
        total_dist += ROAD_INFO[fromNode][route[i]]['distance']
        total_time += ROAD_INFO[fromNode][route[i]]['moving_time'][time]

        fromNode = route[i]

    return total_dist, total_time

# 도로 특성 위치 정보 생성
def getFeatureLocation(type):
    if type == 'children':
        lat_lng = {}
        count = 0
        for fromNode in ROAD_INFO.keys():
            for toNode in ROAD_INFO[fromNode].keys():
                if toNode.isnumeric():
                    if ROAD_INFO[fromNode][toNode]['children_zone_count'] > 0:
                        lat_lng[count] = {}
                        lat_lng[count]['lat'] = (ROAD_INFO[fromNode]['lat'] + ROAD_INFO[toNode]['lat']) / 2
                        lat_lng[count]['lng'] = (ROAD_INFO[fromNode]['lng'] + ROAD_INFO[toNode]['lng']) / 2
                        count += 1

        return printJSON(lat_lng)

    elif type == 'signal':
        lat_lng = {}
        count = 0
        for fromNode in ROAD_INFO.keys():
            for toNode in ROAD_INFO[fromNode].keys():
                if toNode.isnumeric():
                    if ROAD_INFO[fromNode][toNode]['signal_count'] > 0:
                        lat_lng[count] = {}
                        lat_lng[count]['lat'] = (ROAD_INFO[fromNode]['lat'] + ROAD_INFO[toNode]['lat']) / 2
                        lat_lng[count]['lng'] = (ROAD_INFO[fromNode]['lng'] + ROAD_INFO[toNode]['lng']) / 2
                        count += 1

        return printJSON(lat_lng)
    elif type == 'cross':
        lat_lng = {}
        count = 0
        for node in ROAD_INFO.keys():
            if ROAD_INFO[node]['cross_yn'] == 1:
                lat_lng[count] = {}
                lat_lng[count]['lat'] = ROAD_INFO[node]['lat']
                lat_lng[count]['lng'] = ROAD_INFO[node]['lng']
                count += 1

        return printJSON(lat_lng)
    elif type == 'enforce':
        lat_lng = {}
        count = 0
        for fromNode in ROAD_INFO.keys():
            for toNode in ROAD_INFO[fromNode].keys():
                if toNode.isnumeric():
                    if ROAD_INFO[fromNode][toNode]['signal_enforce_count'] or ROAD_INFO[fromNode][toNode]['speed_enforce_count'] > 0:
                        lat_lng[count] = {}
                        lat_lng[count]['lat'] = (ROAD_INFO[fromNode]['lat'] + ROAD_INFO[toNode]['lat']) / 2
                        lat_lng[count]['lng'] = (ROAD_INFO[fromNode]['lng'] + ROAD_INFO[toNode]['lng']) / 2
                        count += 1

        return printJSON(lat_lng)

# 운전자 선호 도로 특성 파악(계수 생성)
def applyDriverCoeff(driver=None, route=None, time=None):
    if driver == None and route == None and time == None:
        f = open("./data/driver_route.dat", 'r')
        while True:
            line = f.readline().rstrip('\n')
            if not line:
                break
            driver_route = line.split("\t")
            if not driver_route[0] in DRIVER_COEFF.keys():
                DRIVER_COEFF[driver_route[0]] = {}
            route = []
            # 운전자 주행 경로 분석
            for i in range(2, len(driver_route)):
                route.append(driver_route[i])

            road_information_driver = analyzeRoadFeature(route)
            driving_dist, driving_time = getTimeAndDistance(route, int(driver_route[1]))

            # 최적 경로 분석
            d = Dijkstra(route[0], route[len(route) - 1], int(driver_route[1]))
            route_dijkstra = d.implement()
            road_information_dijkstra = analyzeRoadFeature(route_dijkstra)

            # 계수 생성
            children_coef = round(( max(road_information_dijkstra['children_zone_count'] - road_information_driver['children_zone_count'], 0) / (road_information_dijkstra['children_zone_count'] + 0.001)) * 100)
            signal_coef = round(( max(road_information_dijkstra['signal_count'] - road_information_driver['signal_count'], 0) / (road_information_dijkstra['signal_count'] + 0.001)) * 100)
            enforce_coef = round(( max(road_information_dijkstra['enforce_count'] - road_information_driver['enforce_count'], 0) / (road_information_dijkstra['enforce_count'] + 0.001)) * 100)
            cross_coef = round(( max(road_information_dijkstra['cross_count'] - road_information_driver['cross_count'], 0) / (road_information_dijkstra['cross_count'] + 0.001)) * 100)
            road_width_coef = round(( max(road_information_driver['road_width'] - road_information_dijkstra['road_width'], 0) / road_information_dijkstra['road_width']) * 100)

            # 계수 저장 - 이미 존재하면 반영 비율로 저장
            if len(DRIVER_COEFF[driver_route[0]].keys()) == 0:
                DRIVER_COEFF[driver_route[0]]['children_coef'] = children_coef
                DRIVER_COEFF[driver_route[0]]['signal_coef'] = signal_coef
                DRIVER_COEFF[driver_route[0]]['enforce_coef'] = enforce_coef
                DRIVER_COEFF[driver_route[0]]['cross_coef'] = cross_coef
                DRIVER_COEFF[driver_route[0]]['road_width_coef'] = road_width_coef
                DRIVER_COEFF[driver_route[0]]['driving_distance'] = driving_dist
            else:
                total_driving_distance = DRIVER_COEFF[driver_route[0]]['driving_distance'] + driving_dist
                apply_rate = [ (DRIVER_COEFF[driver_route[0]]['driving_distance'] / total_driving_distance) , (driving_dist / total_driving_distance) ]
                DRIVER_COEFF[driver_route[0]]['children_coef'] = round(DRIVER_COEFF[driver_route[0]]['children_coef'] * apply_rate[0] + children_coef * apply_rate[1])
                DRIVER_COEFF[driver_route[0]]['signal_coef'] = round(DRIVER_COEFF[driver_route[0]]['signal_coef'] * apply_rate[0] + signal_coef * apply_rate[1])
                DRIVER_COEFF[driver_route[0]]['enforce_coef'] = round(DRIVER_COEFF[driver_route[0]]['enforce_coef'] * apply_rate[0] + enforce_coef * apply_rate[1])
                DRIVER_COEFF[driver_route[0]]['cross_coef'] = round(DRIVER_COEFF[driver_route[0]]['cross_coef'] * apply_rate[0] + cross_coef * apply_rate[1])
                DRIVER_COEFF[driver_route[0]]['road_width_coef'] = round(DRIVER_COEFF[driver_route[0]]['road_width_coef'] * apply_rate[0] + road_width_coef * apply_rate[1])
                DRIVER_COEFF[driver_route[0]]['driving_distance'] = total_driving_distance

        f.close()
    else:
        if not driver in DRIVER_COEFF.keys():
            DRIVER_COEFF[driver] = {}

        driving_dist, driving_time = getTimeAndDistance(route, time)

        # 운전자 주행 경로 분석
        road_information_driver = analyzeRoadFeature(route)

        # 최적 경로 분석
        d = Dijkstra(route[0], route[len(route) - 1], time)
        route_dijkstra = d.implement()
        road_information_dijkstra = analyzeRoadFeature(route_dijkstra)

        # 계수 생성
        children_coef = round(( max(road_information_dijkstra['children_zone_count'] - road_information_driver['children_zone_count'], 0) / (road_information_dijkstra['children_zone_count'] + 0.001)) * 100)
        signal_coef = round(( max(road_information_dijkstra['signal_count'] - road_information_driver['signal_count'], 0) / (road_information_dijkstra['signal_count'] + 0.001)) * 100)
        enforce_coef = round(( max(road_information_dijkstra['enforce_count'] - road_information_driver['enforce_count'], 0) / (road_information_dijkstra['enforce_count'] + 0.001)) * 100)
        cross_coef = round(( max(road_information_dijkstra['cross_count'] - road_information_driver['cross_count'], 0) / (road_information_dijkstra['cross_count'] + 0.001)) * 100)
        road_width_coef = round(( max(road_information_driver['road_width'] - road_information_dijkstra['road_width'], 0) / road_information_dijkstra['road_width']) * 100)

        # 계수 저장 - 이미 존재하면 반영 비율로 저장
        if len(DRIVER_COEFF[driver].keys()) == 0:
            DRIVER_COEFF[driver]['children_coef'] = children_coef
            DRIVER_COEFF[driver]['signal_coef'] = signal_coef
            DRIVER_COEFF[driver]['enforce_coef'] = enforce_coef
            DRIVER_COEFF[driver]['cross_coef'] = cross_coef
            DRIVER_COEFF[driver]['road_width_coef'] = road_width_coef
            DRIVER_COEFF[driver]['driving_distance'] = driving_dist
        else:
            total_driving_distance = DRIVER_COEFF[driver]['driving_distance'] + driving_dist
            apply_rate = [ (DRIVER_COEFF[driver]['driving_distance'] / total_driving_distance) , (driving_dist / total_driving_distance) ]
            if road_information_driver['children_zone_count'] + road_information_dijkstra['children_zone_count'] > 0: DRIVER_COEFF[driver]['children_coef'] = round(DRIVER_COEFF[driver]['children_coef'] * apply_rate[0] + children_coef * apply_rate[1])
            if road_information_driver['signal_count'] + road_information_dijkstra['signal_count'] > 0: DRIVER_COEFF[driver]['signal_coef'] = round(DRIVER_COEFF[driver]['signal_coef'] * apply_rate[0] + signal_coef * apply_rate[1])
            if road_information_driver['enforce_count'] + road_information_dijkstra['enforce_count'] > 0: DRIVER_COEFF[driver]['enforce_coef'] = round(DRIVER_COEFF[driver]['enforce_coef'] * apply_rate[0] + enforce_coef * apply_rate[1])
            if road_information_driver['cross_count'] + road_information_dijkstra['cross_count'] > 0: DRIVER_COEFF[driver]['cross_coef'] = round(DRIVER_COEFF[driver]['cross_coef'] * apply_rate[0] + cross_coef * apply_rate[1])
            if road_information_driver['road_width'] + road_information_dijkstra['road_width'] > 0: DRIVER_COEFF[driver]['road_width_coef'] = round(DRIVER_COEFF[driver]['road_width_coef'] * apply_rate[0] + road_width_coef * apply_rate[1])
            DRIVER_COEFF[driver]['driving_distance'] = total_driving_distance

# HTTP 통신 처리 클래스
class Handler(http.server.BaseHTTPRequestHandler):
    """HTTP 요청을 처리하는 클래스"""

    def do_GET(self):
        """요청 메시지의 메서드가 GET 일 때 호출되어, 응답 메시지를 전송한다."""
        # 응답 메시지의 상태 코드를 전송한다
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*') 

        # 응답 메시지의 헤더를 전송한다
        self.send_header('Content-type', 'text/plain; charset=utf-8')
        self.end_headers()

        # 응답 메시지의 본문을 전송한다
        query = urlparse(self.path).query
        query_components = dict(qc.split("=") for qc in query.split("&"))

        TYPE = query_components['type']

        if TYPE == 'findRoute':
            START = query_components['start']
            FINISH = query_components['finish']
            TIME = int(query_components['time'])
            DRIVER = query_components['driver']

            # 다익스트라(최적경로) 수행
            d = Dijkstra(START, FINISH, TIME)
            route = d.implement()

            total_dist, total_time = getTimeAndDistance(route, TIME)

            result = {}
            result['dijkstra'] = {}
            
            i = 0
            for node in route:
                latlng = {}
                latlng['lat'] = str(ROAD_INFO[node]['lat'])
                latlng['lng'] = str(ROAD_INFO[node]['lng'])
                result['dijkstra'][str(i)] = latlng
                i += 1
            
            result['dijkstra']['result'] = {'dist' : str(round(total_dist, 1)), 'time' : str(round(total_time * 0.6, 0))}

            road_information = analyzeRoadFeature(route)
            result['dijkstra']['feature'] = {'cross_count' : road_information['cross_count'], 'signal_count' : road_information['signal_count'], 'road_width' : road_information['road_width'], 'enforce_count' : road_information['enforce_count'], 'children_zone_count' : road_information['children_zone_count']}
            result['dijkstra']['featureLocation'] = getFeatureLocationOnRoute(route);

            # 휴리스틱 수행
            h = Heuristic(START, FINISH, DRIVER, TIME)
            route = h.implement()
            total_dist, total_time = getTimeAndDistance(route, TIME)

            result['heuristic'] = {}

            i = 0
            for node in route:
                latlng = {}
                latlng['lat'] = str(ROAD_INFO[node]['lat'])
                latlng['lng'] = str(ROAD_INFO[node]['lng'])
                result['heuristic'][str(i)] = latlng
                i += 1

            result['heuristic']['result'] = {'dist' : str(round(total_dist, 1)), 'time' : str(round(total_time * 0.6, 0))}

            road_information = analyzeRoadFeature(route)
            result['heuristic']['feature'] = {'cross_count' : road_information['cross_count'], 'signal_count' : road_information['signal_count'], 'road_width' : road_information['road_width'], 'enforce_count' : road_information['enforce_count'], 'children_zone_count' : road_information['children_zone_count']}
            result['heuristic']['featureLocation'] = getFeatureLocationOnRoute(route);

            # JSON 송신
            self.wfile.write(bytes(printJSON(result), 'utf-8'))

        elif TYPE == 'findNode':
            lat = float(query_components['lat'])
            lng = float(query_components['lng'])

            result_node = findClosestNode([lat, lng])
            result = {}
            result['node'] = result_node
            result['lat'] = ROAD_INFO[result_node]['lat']
            result['lng'] = ROAD_INFO[result_node]['lng']
            result['adjacent'] = {}

            count = 0

            for node in ROAD_INFO[result_node].keys():
                if node.isnumeric():
                    result['adjacent'][str(count)] = {}
                    result['adjacent'][str(count)]['node'] = node
                    result['adjacent'][str(count)]['lat'] = ROAD_INFO[node]['lat']
                    result['adjacent'][str(count)]['lng'] = ROAD_INFO[node]['lng']
                    count += 1

            self.wfile.write(bytes(printJSON(result), 'utf-8'))

        elif TYPE == 'getFeature':
            if query_components['feature_type'] == 'children':
                self.wfile.write(bytes(getFeatureLocation('children'), 'utf-8'))
            elif query_components['feature_type'] == 'enforce':
                self.wfile.write(bytes(getFeatureLocation('enforce'), 'utf-8'))
            elif query_components['feature_type'] == 'signal':
                self.wfile.write(bytes(getFeatureLocation('signal'), 'utf-8'))

        elif TYPE == 'analyzeRoute':
            if query_components['end'] == 'true':
                TIME = int(query_components['time'])
                route = query_components['route'].split('%2C')
                applyDriverCoeff(query_components['driver'], route, TIME)

                result = {}
                result['result'] = 'ok'

                # JSON 송신
                self.wfile.write(bytes(printJSON(result), 'utf-8'))
            else:
                TIME = int(query_components['time'])
                result = {}

                # 주행 경로 분석
                route = query_components['route'].split('%2C')
                road_information = analyzeRoadFeature(route)
                total_dist, total_time = getTimeAndDistance(route, TIME)

                result['driver'] = {}
                result['driver']['result'] = {'dist' : str(round(total_dist, 1)), 'time' : str(round(total_time * 0.6, 0))}
                result['driver']['feature'] = {'cross_count' : road_information['cross_count'], 'signal_count' : road_information['signal_count'], 'road_width' : road_information['road_width'], 'enforce_count' : road_information['enforce_count'], 'children_zone_count' : road_information['children_zone_count']}

                # 다익스트라(최적경로) 분석
                d = Dijkstra(route[0], route[len(route) - 1], TIME)
                route = d.implement()
                road_information = analyzeRoadFeature(route)
                total_dist, total_time = getTimeAndDistance(route, TIME)

                result['dijkstra'] = {}
                result['dijkstra']['result'] = {'dist' : str(round(total_dist, 1)), 'time' : str(round(total_time * 0.6, 0))}
                result['dijkstra']['feature'] = {'cross_count' : road_information['cross_count'], 'signal_count' : road_information['signal_count'], 'road_width' : road_information['road_width'], 'enforce_count' : road_information['enforce_count'], 'children_zone_count' : road_information['children_zone_count']}
                result['dijkstra']['route'] = {}
                
                for i in range(0, len(route)):
                    result['dijkstra']['route'][str(i)] = {'lat' : ROAD_INFO[route[i]]['lat'], 'lng' : ROAD_INFO[route[i]]['lng']}

                # JSON 송신
                self.wfile.write(bytes(printJSON(result), 'utf-8'))

        elif TYPE == 'getDriverCoef':
            # JSON 송신
            self.wfile.write(bytes(printJSON(DRIVER_COEFF[query_components['driver']]), 'utf-8'))

        elif TYPE == 'resetDriverCoef':
            DRIVER_COEFF[query_components['driver']] = {}
            
            # JSON 송신
            result = {}
            result['result'] = 'ok'
            self.wfile.write(bytes(printJSON(result), 'utf-8'))

if __name__ == "__main__":
    init()

    # 요청받을 주소 (요청을 감시할 주소)
    address = ('', 8070)

    # 요청 대기하기
    listener = http.server.HTTPServer(address, Handler)
    print('Navigation Engine Started.')
    listener.serve_forever()
