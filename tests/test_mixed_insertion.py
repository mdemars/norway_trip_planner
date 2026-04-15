"""
Tests for inserting stops and road stops (undated stops) between existing locations.

Scenario
--------
A trip is built with two anchor stops (A and C), then road stops and a stop
are inserted in the gap between them:

  A  →  W1  →  B  →  W2  →  C

Insertion order
---------------
1. Stop A     (appended first — becomes chain head)
2. Stop C     (appended after A)
3. Road stop W1 inserted between A and C  (previous_location_guid = A.guid)
4. Road stop W2 inserted between W1 and C (previous_location_guid = W1.guid)
5. Stop B     inserted between W1 and W2 (previous_location_guid = W1.guid)

Each insertion that targets an occupied predecessor slot must re-link the
existing follower to maintain a valid single-threaded chain.

Assertions
----------
1. GET /api/trips/<id>/debug/route-points returns the five locations in the
   correct chain order: A, W1, B, W2, C.
2. GET /api/trips/<id>/stops returns all five locations in chain order.
"""
import json


def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type='application/json')


GPS = {'location_type': 'gps'}
DATES = {'start_date': '2026-07-01', 'end_date': '2026-07-03'}


def _make_stop(client, trip_id, name, lat, **extra):
    return post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': name, 'latitude': lat, 'longitude': 0.0, **GPS, **DATES, **extra
    }).get_json()


def _make_road_stop(client, trip_id, name, lat, **extra):
    """Create a road stop (stop without dates)."""
    return post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': name, 'latitude': lat, 'longitude': 0.0, **GPS, **extra
    }).get_json()


def test_interleaved_stops_and_road_stops_maintain_chain_order(client):
    trip_id = post_json(client, '/api/trips', {'name': 'Interleaved test'}).get_json()['id']

    # 1. Stop A — becomes the chain head
    stop_a = _make_stop(client, trip_id, 'A', lat=1.0)

    # 2. Stop C — auto-appended after A
    stop_c = _make_stop(client, trip_id, 'C', lat=5.0)

    # 3. Road stop W1 — inserted between A and C
    #    Re-linking must update C so that C.previous_location_guid = W1.guid
    wp1 = _make_road_stop(client, trip_id, 'W1', lat=2.0,
                          previous_location_guid=stop_a['guid'])

    # 4. Road stop W2 — inserted between W1 and C
    #    Re-linking must update C so that C.previous_location_guid = W2.guid
    wp2 = _make_road_stop(client, trip_id, 'W2', lat=4.0,
                          previous_location_guid=wp1['guid'])

    # 5. Stop B — inserted between W1 and W2
    #    Re-linking must update W2 so that W2.previous_location_guid = B.guid
    stop_b = _make_stop(client, trip_id, 'B', lat=3.0,
                        previous_location_guid=wp1['guid'])

    # ── 1. Full chain order via debug endpoint ────────────────────────────────
    route_resp = client.get(f'/api/trips/{trip_id}/debug/route-points')
    assert route_resp.status_code == 200
    names = [p['name'] for p in route_resp.get_json()['points']]
    assert names == ['A', 'W1', 'B', 'W2', 'C'], (
        f"Expected ['A', 'W1', 'B', 'W2', 'C'] but got {names}. "
        "Re-linking during road-stop/stop insertion is likely broken."
    )

    # ── 2. Stops endpoint returns all locations in chain order ────────────────
    stops_resp = client.get(f'/api/trips/{trip_id}/stops')
    assert stops_resp.status_code == 200
    all_names = [s['name'] for s in stops_resp.get_json()]
    assert all_names == ['A', 'W1', 'B', 'W2', 'C'], (
        f"Expected all locations ['A', 'W1', 'B', 'W2', 'C'] but got {all_names}."
    )
