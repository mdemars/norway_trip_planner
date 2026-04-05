import io
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, send_file
from models import Trip, Stop, Location, RouteCache, get_db
from services import geocoding_service, route_service
from helpers import get_ordered_locations
from config import Config

routing_bp = Blueprint('routing', __name__, url_prefix='/api')


@routing_bp.route('/trips/<int:trip_id>/route', methods=['GET'])
def get_trip_route(trip_id):
    """Calculate route and distances for a trip"""
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Get ordered locations via chain
        ordered_locations = get_ordered_locations(db, trip_id)
        if not ordered_locations:
            return jsonify({'error': 'No locations found for this trip'}), 404

        # Build point list, validating coordinates
        all_points = []
        for loc in ordered_locations:
            if not loc.latitude or not loc.longitude:
                return jsonify({
                    'error': f'Location "{loc.name}" does not have valid coordinates'
                }), 400
            point_data = loc.to_dict(include_activities=False) if isinstance(loc, Stop) else loc.to_dict()
            point_data['latitude'] = loc.latitude
            point_data['longitude'] = loc.longitude
            all_points.append(point_data)

        # Add trip start location at the beginning if it exists
        if trip.start_location_latitude and trip.start_location_longitude:
            all_points.insert(0, {
                'id': 0,
                'name': 'Trip Start',
                'latitude': trip.start_location_latitude,
                'longitude': trip.start_location_longitude,
                'address': trip.start_location_address,
                'type': 'start'
            })

        # Add trip end location at the end if it exists
        if trip.end_location_latitude and trip.end_location_longitude:
            all_points.append({
                'id': len(all_points),
                'name': 'Trip End',
                'latitude': trip.end_location_latitude,
                'longitude': trip.end_location_longitude,
                'address': trip.end_location_address,
                'type': 'end'
            })

        route_info = route_service.calculate_route(all_points)
        _upsert_route_cache(db, trip_id, all_points, route_info)
        return jsonify(route_info)
    finally:
        db.close()


def _fetch_static_map_image(all_points, route_info):
    """Fetch a static map PNG from Google Maps Static API."""
    api_key = Config.GOOGLE_MAPS_API_KEY
    if not api_key or not all_points:
        return None

    params = [
        ('size', '800x500'),
        ('maptype', 'roadmap'),
        ('key', api_key),
    ]

    for pt in all_points:
        pt_type = pt.get('type', 'stop')
        color = 'green' if pt_type == 'start' else ('blue' if pt_type == 'end' else 'red')
        params.append(('markers', f'color:{color}|{pt["latitude"]},{pt["longitude"]}'))

    if route_info and route_info.get('segments'):
        for seg in route_info['segments']:
            if seg.get('polyline'):
                params.append(('path', f'enc:{seg["polyline"]}'))

    url = 'https://maps.googleapis.com/maps/api/staticmap?' + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            if resp.status == 200:
                return resp.read()
    except Exception:
        pass
    return None


def _upsert_route_cache(db, trip_id, all_points, route_info):
    """Save route points + static map image to RouteCache, replacing any existing entry."""
    route_json = json.dumps({'points': all_points, 'route': route_info})
    route_image = _fetch_static_map_image(all_points, route_info)
    now = datetime.now(timezone.utc)

    existing = db.query(RouteCache).filter(RouteCache.trip_id == trip_id).first()
    if existing:
        existing.route_json = route_json
        existing.route_image = route_image
        existing.calculated_at = now
    else:
        db.add(RouteCache(trip_id=trip_id, route_json=route_json,
                          route_image=route_image, calculated_at=now))
    db.commit()


@routing_bp.route('/trips/<int:trip_id>/debug/route-points', methods=['GET'])
def get_debug_route_points(trip_id):
    """Debug endpoint: Get all route points in order"""
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        all_points = []

        # Add trip start location at the beginning if it exists
        if trip.start_location_latitude and trip.start_location_longitude:
            all_points.append({
                'order': 0,
                'type': 'start',
                'name': 'Trip Start',
                'address': trip.start_location_address,
                'latitude': trip.start_location_latitude,
                'longitude': trip.start_location_longitude,
            })

        # Walk the location chain
        ordered_locations = get_ordered_locations(db, trip_id)
        for i, loc in enumerate(ordered_locations):
            loc_type = 'stop' if isinstance(loc, Stop) else 'waypoint'
            all_points.append({
                'order': len(all_points),
                'type': loc_type,
                'name': loc.name,
                'address': loc.address,
                'latitude': loc.latitude,
                'longitude': loc.longitude,
                'guid': loc.guid,
                'previous_location_guid': loc.previous_location_guid,
            })

        # Add trip end location at the end if it exists
        if trip.end_location_latitude and trip.end_location_longitude:
            all_points.append({
                'order': len(all_points),
                'type': 'end',
                'name': 'Trip End',
                'address': trip.end_location_address,
                'latitude': trip.end_location_latitude,
                'longitude': trip.end_location_longitude,
            })

        return jsonify({
            'trip_id': trip_id,
            'trip_name': trip.name,
            'total_points': len(all_points),
            'points': all_points
        })
    finally:
        db.close()


@routing_bp.route('/trips/<int:trip_id>/locations', methods=['GET'])
def get_trip_locations(trip_id):
    """Get all locations for a trip in reverse order (from end to start)"""
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        ordered_locations = get_ordered_locations(db, trip_id)
        if not ordered_locations:
            return jsonify([])

        locations = []
        for loc in reversed(ordered_locations):
            if isinstance(loc, Stop):
                locations.append(loc.to_dict(include_activities=False))
            else:
                locations.append(loc.to_dict())

        return jsonify(locations)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@routing_bp.route('/trips/<int:trip_id>/route/image', methods=['GET'])
def get_trip_route_image(trip_id):
    """Serve the cached static map PNG for a trip's most recent route calculation."""
    db = get_db()
    try:
        cache = db.query(RouteCache).filter(RouteCache.trip_id == trip_id).first()
        if not cache or not cache.route_image:
            return jsonify({'error': 'No route image available. Calculate the route first.'}), 404
        return send_file(io.BytesIO(cache.route_image), mimetype='image/png')
    finally:
        db.close()


@routing_bp.route('/validate-address', methods=['POST'])
def validate_address():
    """Validate an address by attempting to geocode it"""
    data = request.json

    if not data or not data.get('address'):
        return jsonify({'valid': False, 'error': 'Address is required'}), 400

    address = data['address'].strip()

    if not address:
        return jsonify({'valid': False, 'error': 'Address cannot be empty'}), 400

    coords = geocoding_service.geocode_address(address)

    if coords:
        latitude, longitude = coords
        return jsonify({
            'valid': True,
            'latitude': latitude,
            'longitude': longitude
        })
    else:
        return jsonify({
            'valid': False,
            'error': 'Address not found'
        })
