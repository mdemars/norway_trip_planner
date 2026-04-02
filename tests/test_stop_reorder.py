"""
Regression test: after reordering stops by changing their dates, the order
returned by GET /api/trips/<id>/stops must match the order used by
GET /api/trips/<id>/debug/route-points (the route calculation chain).

Currently FAILS because:
  • GET /api/trips/<id>/stops       orders by start_date  (updates after PUT)
  • GET /api/trips/<id>/debug/route-points  orders by linked-list chain (unchanged)
"""
import json


def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type='application/json')


def put_json(client, url, payload):
    return client.put(url, data=json.dumps(payload), content_type='application/json')


def test_stop_display_order_matches_route_order_after_date_change(client):
    """
    After a user reorders stops by changing their dates, the stop list and the
    route must visit stops in the same order.

    Scenario
    --------
    1. Create a trip with two stops in creation order:
         Stop A — Oslo,   3 nights (July 1–4)   → first in chain
         Stop B — Bergen, 4 nights (July 4–8)   → second in chain
    2. Swap dates via PUT so Bergen now has the earlier start date:
         Bergen 2026-07-01 → 2026-07-05  (still 4 nights)
         Oslo   2026-07-05 → 2026-07-08  (still 3 nights)
    3. GET /api/trips/<id>/stops returns stops ordered by start_date → [Bergen, Oslo]
    4. GET /api/trips/<id>/debug/route-points returns stops in chain order → [Oslo, Bergen]
    5. Assert both orders are the same — FAILS until the chain is kept in sync
       with dates (or the route endpoint is changed to sort by date).
    """
    # ── 1. Create trip and two stops ─────────────────────────────────────────
    trip_id = post_json(client, '/api/trips', {'name': 'Reorder test'}).get_json()['id']

    stop_a = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Oslo',
        'start_date': '2026-07-01',
        'end_date': '2026-07-04',
        'location_type': 'gps',
        'latitude': 59.9139,
        'longitude': 10.7522,
    }).get_json()

    stop_b = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Bergen',
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
        'location_type': 'gps',
        'latitude': 60.3913,
        'longitude': 5.3221,
    }).get_json()

    # ── 2. Reorder by changing dates (what a user does via the UI) ────────────
    put_json(client, f'/api/stops/{stop_b["id"]}', {
        'start_date': '2026-07-01',
        'end_date': '2026-07-05',
    })
    put_json(client, f'/api/stops/{stop_a["id"]}', {
        'start_date': '2026-07-05',
        'end_date': '2026-07-08',
    })

    # ── 3. Stop list order (by start_date) ───────────────────────────────────
    stops_resp = client.get(f'/api/trips/{trip_id}/stops')
    assert stops_resp.status_code == 200
    stop_list_order = [s['name'] for s in stops_resp.get_json()]

    # ── 4. Route chain order ──────────────────────────────────────────────────
    route_resp = client.get(f'/api/trips/{trip_id}/debug/route-points')
    assert route_resp.status_code == 200
    route_chain_order = [
        p['name'] for p in route_resp.get_json()['points']
        if p['type'] == 'stop'
    ]

    # ── 5. They must be the same ──────────────────────────────────────────────
    assert stop_list_order == route_chain_order, (
        f"Stop list order {stop_list_order} does not match "
        f"route chain order {route_chain_order}. "
        f"Updating stop dates must also update the location chain."
    )


def test_waypoint_stays_between_stops_after_date_swap(client):
    """
    After swapping stop dates, a waypoint that sat between the two stops must
    remain between them in the route — it should not stay anchored to its
    original predecessor stop.

    Scenario
    --------
    1. Create two stops in order:
         Bergen  July 4–8   → first in chain
         Oslo    July 8–11  → second in chain
    2. Insert a waypoint explicitly between them (previous_location_guid = Bergen).
       Oslo auto-appends after the waypoint, so the chain is:
         Bergen → Waypoint → Oslo
    3. Swap dates via PUT:
         Oslo   → July 4–8  (now the earlier stop)
         Bergen → July 8–11 (now the later stop)
    4. GET /api/trips/<id>/debug/route-points must return:
         Oslo → Waypoint → Bergen
       The waypoint must stay between the two stops, not be left after Bergen
       at the tail (Oslo → Bergen → Waypoint).
    """
    # ── 1 & 2. Create trip, two stops, and a waypoint between them ───────────
    trip_id = post_json(client, '/api/trips', {'name': 'Waypoint reorder test'}).get_json()['id']

    stop_a = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Bergen',
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
        'location_type': 'gps',
        'latitude': 60.3913,
        'longitude': 5.3221,
    }).get_json()

    # Waypoint sits immediately after Bergen
    waypoint = post_json(client, f'/api/trips/{trip_id}/waypoints', {
        'name': 'Scenic viewpoint',
        'location_type': 'gps',
        'latitude': 60.1000,
        'longitude': 6.5000,
        'previous_location_guid': stop_a['guid'],
    }).get_json()

    # Oslo auto-appends after the waypoint (last location by id)
    stop_b = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Oslo',
        'start_date': '2026-07-08',
        'end_date': '2026-07-11',
        'location_type': 'gps',
        'latitude': 59.9139,
        'longitude': 10.7522,
    }).get_json()

    # ── 3. Swap dates ─────────────────────────────────────────────────────────
    put_json(client, f'/api/stops/{stop_b["id"]}', {
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
    })
    put_json(client, f'/api/stops/{stop_a["id"]}', {
        'start_date': '2026-07-08',
        'end_date': '2026-07-11',
    })

    # ── 4. Route chain order ──────────────────────────────────────────────────
    route_resp = client.get(f'/api/trips/{trip_id}/debug/route-points')
    assert route_resp.status_code == 200
    route_points = route_resp.get_json()['points']
    route_names = [p['name'] for p in route_points]

    assert route_names == ['Oslo', 'Scenic viewpoint', 'Bergen'], (
        f"Expected ['Oslo', 'Scenic viewpoint', 'Bergen'] but got {route_names}. "
        f"The waypoint must remain between the two stops after the date swap."
    )
