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


def test_road_stop_stays_between_stops_after_date_swap(client):
    """
    After swapping stop dates, the chain order must remain unchanged and the
    road stop must stay between the same two overnight stops.

    Route order is determined by the explicit chain (linked list), not by dates.
    Changing dates does not reorder the chain.

    Scenario
    --------
    1. Create two stops in order:
         Bergen  July 4–8   → first in chain
         Oslo    July 8–11  → second in chain
    2. Insert a road stop explicitly between them (previous_location_guid = Bergen).
       Oslo auto-appends after the road stop, so the chain is:
         Bergen → Scenic viewpoint → Oslo
    3. Swap dates via PUT:
         Oslo   → July 4–8
         Bergen → July 8–11
    4. GET /api/trips/<id>/debug/route-points must still return:
         Bergen → Scenic viewpoint → Oslo
       Chain order is unchanged; dates are just metadata.
    """
    trip_id = post_json(client, '/api/trips', {'name': 'Road stop reorder test'}).get_json()['id']

    stop_a = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Bergen',
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
        'location_type': 'gps',
        'latitude': 60.3913,
        'longitude': 5.3221,
    }).get_json()

    # Road stop (no dates) sits immediately after Bergen
    post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Scenic viewpoint',
        'location_type': 'gps',
        'latitude': 60.1000,
        'longitude': 6.5000,
        'previous_location_guid': stop_a['guid'],
    })

    stop_b = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Oslo',
        'start_date': '2026-07-08',
        'end_date': '2026-07-11',
        'location_type': 'gps',
        'latitude': 59.9139,
        'longitude': 10.7522,
    }).get_json()

    # Swap dates — chain order must not change
    put_json(client, f'/api/stops/{stop_b["id"]}', {
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
    })
    put_json(client, f'/api/stops/{stop_a["id"]}', {
        'start_date': '2026-07-08',
        'end_date': '2026-07-11',
    })

    route_resp = client.get(f'/api/trips/{trip_id}/debug/route-points')
    assert route_resp.status_code == 200
    route_names = [p['name'] for p in route_resp.get_json()['points']]

    assert route_names == ['Bergen', 'Scenic viewpoint', 'Oslo'], (
        f"Expected ['Bergen', 'Scenic viewpoint', 'Oslo'] but got {route_names}. "
        f"Chain order must not change when dates are updated."
    )
