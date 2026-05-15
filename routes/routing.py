import json
import math
from flask import Blueprint, request, jsonify
from models import Trip, Stop, Location, get_db
from services import geocoding_service, route_service
from helpers import get_ordered_locations


def _haversine_km(lat1, lon1, lat2, lon2):
    """Straight-line distance between two GPS points using the Haversine formula."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(a)), 2)

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
        return jsonify(route_info)
    finally:
        db.close()


@routing_bp.route('/trips/<int:trip_id>/save-distances', methods=['POST'])
def save_route_distances(trip_id):
    """Save route distances to stop/waypoint locations
    
    Expected request body:
    {
        "segments": [
            {
                "to_guid": "location-guid",
                "distance_km": 123.45
            },
            ...
        ]
    }
    """
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        data = request.json
        if not data or 'segments' not in data:
            return jsonify({'error': 'segments array is required'}), 400
        
        segments = data['segments']
        updated_count = 0

        for segment in segments:
            to_guid = segment.get('to_guid')
            distance_km = segment.get('distance_km')

            if not to_guid or distance_km is None:
                continue

            location = db.query(Location).filter(
                Location.trip_id == trip_id,
                Location.guid == to_guid
            ).first()

            if location:
                location.distance_km = distance_km
                updated_count += 1

        # Persist the leg from the last stop to the trip end, if provided
        end_distance_km = data.get('end_distance_km')
        if end_distance_km is not None:
            trip.end_location_distance_km = end_distance_km

        total_distance_km = data.get('total_distance_km')
        if total_distance_km is not None:
            trip.total_distance_km = total_distance_km

        db.commit()

        # Fetch and return updated locations
        ordered_locations = get_ordered_locations(db, trip_id)
        result = []
        for loc in ordered_locations:
            if isinstance(loc, Stop):
                result.append(loc.to_dict(include_activities=False))
            else:
                result.append(loc.to_dict())

        return jsonify({
            'success': True,
            'updated_count': updated_count,
            'end_distance_km': trip.end_location_distance_km,
            'total_distance_km': trip.total_distance_km,
            'locations': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()



@routing_bp.route('/trips/<int:trip_id>/clear-distances', methods=['POST'])
def clear_route_distances(trip_id):
    """Clear all route distances for a trip (call this when stops/waypoints are added/removed)"""
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        # Clear all distances for locations in this trip
        cleared_count = db.query(Location).filter(
            Location.trip_id == trip_id,
            Location.distance_km != None
        ).count()
        
        db.query(Location).filter(
            Location.trip_id == trip_id
        ).update({Location.distance_km: None}, synchronize_session=False)

        trip.end_location_distance_km = None
        trip.total_distance_km = None
        db.commit()

        return jsonify({
            'success': True,
            'cleared_count': cleared_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()



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
        for loc in ordered_locations:
            loc_type = 'stop'
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



@routing_bp.route('/trips/<int:trip_id>/update-countries', methods=['POST'])
def update_trip_countries(trip_id):
    """Reverse-geocode all stop coordinates, derive unique country codes, and persist them on the trip."""
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        ordered_locations = get_ordered_locations(db, trip_id)

        # Collect all coordinate points (stops + trip start/end)
        points = []
        if trip.start_location_latitude and trip.start_location_longitude:
            points.append((trip.start_location_latitude, trip.start_location_longitude))
        for loc in ordered_locations:
            if loc.latitude and loc.longitude:
                points.append((loc.latitude, loc.longitude))
        if trip.end_location_latitude and trip.end_location_longitude:
            points.append((trip.end_location_latitude, trip.end_location_longitude))

        if not points:
            return jsonify({'error': 'No coordinates available for this trip'}), 400

        # Reverse-geocode each point to get country code, deduplicating results.
        country_codes = []
        for lat, lng in points:
            code = geocoding_service.get_country_code(lat, lng)
            if code and code not in country_codes:
                country_codes.append(code)

        trip.country_codes = json.dumps(country_codes)
        db.commit()

        return jsonify({'country_codes': country_codes})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@routing_bp.route('/trips/<int:trip_id>/segments', methods=['GET'])
def get_trip_segments(trip_id):
    """Fast straight-line distance estimate between consecutive stops.

    Uses the Haversine formula on stored coordinates — no external API call,
    responds in milliseconds regardless of trip length.

    This is the correct endpoint for validating a maximum driving distance between stops.
    Straight-line distances are always shorter than actual driving distances, so
    any segment flagged here will definitely exceed the limit by road too.

    Query parameters:
        max_km (float, optional): Maximum allowed straight-line distance per segment.
                                  Defaults to 500.

    For exact driving distances and polylines, use GET /trips/{id}/route instead
    (that endpoint calls Google Maps and counts against your API quota).
    """
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Build ordered point list: trip-start → stops/waypoints → trip-end
        points = []
        if trip.start_location_latitude and trip.start_location_longitude:
            points.append({
                'name': 'Trip Start',
                'guid': None,
                'latitude': trip.start_location_latitude,
                'longitude': trip.start_location_longitude,
            })

        for loc in get_ordered_locations(db, trip_id):
            if loc.latitude and loc.longitude:
                points.append({
                    'name': loc.name,
                    'guid': loc.guid,
                    'latitude': loc.latitude,
                    'longitude': loc.longitude,
                })

        if trip.end_location_latitude and trip.end_location_longitude:
            points.append({
                'name': 'Trip End',
                'guid': None,
                'latitude': trip.end_location_latitude,
                'longitude': trip.end_location_longitude,
            })

        if len(points) < 2:
            return jsonify({'segments': [], 'warnings': [], 'all_ok': True})

        try:
            max_km = float(request.args.get('max_km', 500))
            if max_km <= 0:
                raise ValueError()
        except ValueError:
            return jsonify({'error': 'max_km must be a positive number'}), 400

        MAX_KM = max_km
        segments = []
        warnings = []

        for i in range(len(points) - 1):
            p1, p2 = points[i], points[i + 1]
            dist = _haversine_km(p1['latitude'], p1['longitude'], p2['latitude'], p2['longitude'])
            over = dist > MAX_KM
            segments.append({
                'from_name': p1['name'],
                'to_name': p2['name'],
                'to_guid': p2['guid'],
                'distance_km': dist,
                'over_500km': over,
            })
            if over:
                warnings.append(
                    f"{p1['name']} \u2192 {p2['name']}: {dist} km straight-line "
                    f"(exceeds 500 km \u2014 actual driving distance will be longer)"
                )

        return jsonify({
            'segments': segments,
            'warnings': warnings,
            'all_ok': len(warnings) == 0,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
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


@routing_bp.route('/places/search', methods=['POST'])
def search_places():
    """Search for places using Google Maps Places API"""
    data = request.json

    if not data or not data.get('query'):
        return jsonify({'error': 'Search query is required'}), 400

    query = data['query'].strip()

    if not query:
        return jsonify({'error': 'Search query cannot be empty'}), 400

    try:
        places = geocoding_service.search_places(query)
        return jsonify({'places': places})
    except Exception as e:
        print(f"Places search error: {e}")
        return jsonify({'error': 'Failed to search places'}), 500
