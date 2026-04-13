"""
Tests for persisting route distances via POST /api/trips/<id>/save-distances.

Scenario
--------
After calling "Calculate Route" the UI sends each segment's distance_km paired
with the destination location's guid to the save-distances endpoint.  The backend
writes the value into locations.distance_km and returns the updated list.

These tests verify that:
  1. A valid request saves distance_km on the target locations.
  2. Locations not included in the request are left untouched (NULL).
  3. Sending an unknown guid is silently skipped (updated_count reflects this).
  4. POST /api/trips/<id>/clear-distances sets all distances back to NULL.
"""
import json


def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type='application/json')


def _create_trip_with_two_stops(client):
    """Helper: create a trip with Oslo → Bergen and return (trip_id, stop_a, stop_b)."""
    trip_id = post_json(client, '/api/trips', {'name': 'Distance test'}).get_json()['id']

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

    return trip_id, stop_a, stop_b


def test_save_distances_persists_to_locations(client):
    """
    POST /api/trips/<id>/save-distances with valid guids must persist
    distance_km on the matching locations and return them in the response.
    """
    trip_id, stop_a, stop_b = _create_trip_with_two_stops(client)

    resp = post_json(client, f'/api/trips/{trip_id}/save-distances', {
        'segments': [
            {'to_guid': stop_a['guid'], 'distance_km': 100.5},
            {'to_guid': stop_b['guid'], 'distance_km': 234.7},
        ]
    })

    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert data['updated_count'] == 2

    by_name = {loc['name']: loc for loc in data['locations']}
    assert by_name['Oslo']['distance_km'] == 100.5, (
        f"Expected Oslo distance_km=100.5, got {by_name['Oslo']['distance_km']}"
    )
    assert by_name['Bergen']['distance_km'] == 234.7, (
        f"Expected Bergen distance_km=234.7, got {by_name['Bergen']['distance_km']}"
    )


def test_save_distances_only_updates_included_locations(client):
    """
    Locations whose guid is not in the segments payload must keep distance_km=NULL.
    """
    trip_id, stop_a, stop_b = _create_trip_with_two_stops(client)

    # Only send a distance for stop_b
    resp = post_json(client, f'/api/trips/{trip_id}/save-distances', {
        'segments': [
            {'to_guid': stop_b['guid'], 'distance_km': 234.7},
        ]
    })

    assert resp.status_code == 200
    data = resp.get_json()
    assert data['updated_count'] == 1

    by_name = {loc['name']: loc for loc in data['locations']}
    assert by_name['Oslo']['distance_km'] is None, (
        f"Oslo should be untouched (NULL), got {by_name['Oslo']['distance_km']}"
    )
    assert by_name['Bergen']['distance_km'] == 234.7


def test_save_distances_unknown_guid_is_skipped(client):
    """
    An unknown guid in the segments payload must be silently skipped;
    updated_count must not include it.
    """
    trip_id, stop_a, stop_b = _create_trip_with_two_stops(client)

    resp = post_json(client, f'/api/trips/{trip_id}/save-distances', {
        'segments': [
            {'to_guid': 'does-not-exist', 'distance_km': 999.0},
            {'to_guid': stop_b['guid'], 'distance_km': 234.7},
        ]
    })

    assert resp.status_code == 200
    data = resp.get_json()
    assert data['updated_count'] == 1, (
        f"Only 1 valid guid in payload, expected updated_count=1, got {data['updated_count']}"
    )


def test_clear_distances_resets_all_to_null(client):
    """
    POST /api/trips/<id>/clear-distances must set distance_km to NULL for all
    locations in the trip, regardless of what was previously saved.
    """
    trip_id, stop_a, stop_b = _create_trip_with_two_stops(client)

    # First save some distances
    post_json(client, f'/api/trips/{trip_id}/save-distances', {
        'segments': [
            {'to_guid': stop_a['guid'], 'distance_km': 100.5},
            {'to_guid': stop_b['guid'], 'distance_km': 234.7},
        ]
    })

    # Now clear them
    clear_resp = client.post(f'/api/trips/{trip_id}/clear-distances',
                             content_type='application/json')
    assert clear_resp.status_code == 200
    assert clear_resp.get_json()['success'] is True

    # Fetch stops and confirm distances are gone
    stops_resp = client.get(f'/api/trips/{trip_id}/stops')
    assert stops_resp.status_code == 200
    for stop in stops_resp.get_json():
        assert stop['distance_km'] is None, (
            f"Expected NULL after clear but {stop['name']} has distance_km={stop['distance_km']}"
        )
