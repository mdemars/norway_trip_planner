"""
Tests for chain relinking when a stop is deleted.

When stop B is deleted from chain A → B → C, C must be relinked to A so the
chain becomes A → C.
"""
import json


def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type='application/json')


def test_delete_middle_stop_relinks_chain(client):
    """
    Chain: Oslo → Scenic viewpoint (road stop) → Bergen → Trondheim
    Delete Bergen → chain must become: Oslo → Scenic viewpoint → Trondheim
    """
    trip_id = post_json(client, '/api/trips', {'name': 'Delete relink test'}).get_json()['id']

    oslo = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Oslo',
        'start_date': '2026-07-01',
        'end_date': '2026-07-04',
        'location_type': 'gps',
        'latitude': 59.9139,
        'longitude': 10.7522,
    }).get_json()

    post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Scenic viewpoint',
        'location_type': 'gps',
        'latitude': 60.1000,
        'longitude': 6.5000,
        'previous_location_guid': oslo['guid'],
    })

    bergen = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Bergen',
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
        'location_type': 'gps',
        'latitude': 60.3913,
        'longitude': 5.3221,
    }).get_json()

    post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Trondheim',
        'start_date': '2026-07-08',
        'end_date': '2026-07-11',
        'location_type': 'gps',
        'latitude': 63.4305,
        'longitude': 10.3951,
    })

    # Verify initial chain order
    before = [s['name'] for s in client.get(f'/api/trips/{trip_id}/stops').get_json()]
    assert before == ['Oslo', 'Scenic viewpoint', 'Bergen', 'Trondheim']

    # Delete Bergen
    resp = client.delete(f'/api/stops/{bergen["id"]}')
    assert resp.status_code == 200

    after = [s['name'] for s in client.get(f'/api/trips/{trip_id}/stops').get_json()]
    assert after == ['Oslo', 'Scenic viewpoint', 'Trondheim'], (
        f"Expected ['Oslo', 'Scenic viewpoint', 'Trondheim'] but got {after}. "
        f"Deleting Bergen must relink Trondheim to Scenic viewpoint."
    )


def test_delete_first_stop_makes_second_chain_head(client):
    """
    Chain: Oslo → Bergen → Trondheim
    Delete Oslo → chain must become: Bergen → Trondheim
    """
    trip_id = post_json(client, '/api/trips', {'name': 'Delete head test'}).get_json()['id']

    oslo = post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Oslo',
        'start_date': '2026-07-01',
        'end_date': '2026-07-04',
        'location_type': 'gps',
        'latitude': 59.9139,
        'longitude': 10.7522,
    }).get_json()

    post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Bergen',
        'start_date': '2026-07-04',
        'end_date': '2026-07-08',
        'location_type': 'gps',
        'latitude': 60.3913,
        'longitude': 5.3221,
    })

    post_json(client, f'/api/trips/{trip_id}/stops', {
        'name': 'Trondheim',
        'start_date': '2026-07-08',
        'end_date': '2026-07-11',
        'location_type': 'gps',
        'latitude': 63.4305,
        'longitude': 10.3951,
    })

    resp = client.delete(f'/api/stops/{oslo["id"]}')
    assert resp.status_code == 200

    after = [s['name'] for s in client.get(f'/api/trips/{trip_id}/stops').get_json()]
    assert after == ['Bergen', 'Trondheim'], (
        f"Expected ['Bergen', 'Trondheim'] but got {after}."
    )
