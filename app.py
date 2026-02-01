from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from datetime import datetime
from config import Config
from models import Trip, Stop, Activity, Waypoint, Location, init_db, get_db
from services import geocoding_service, route_service
import os

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Validate configuration
Config.validate()

# Initialize database
init_db()


# ============================================================================
# Web Routes (HTML Pages)
# ============================================================================

@app.route('/')
def index():
    """Home page - list of all trips"""
    return render_template('index.html')

@app.route('/trip/<int:trip_id>')
def trip_detail(trip_id):
    """Trip detail page"""
    return render_template('trip_detail.html', trip_id=trip_id, config=Config)

@app.route('/favicon.ico')
def favicon():
    """Serve favicon"""
    return send_from_directory(
        os.path.join(app.root_path, 'static', 'images'),
        'campervan.png',
        mimetype='image/png'
    )


# ============================================================================
# API Routes - Trips
# ============================================================================

@app.route('/api/trips', methods=['GET'])
def get_trips():
    """Get all trips"""
    db = get_db()
    try:
        trips = db.query(Trip).all()
        return jsonify([trip.to_dict(include_stops=True) for trip in trips])
    finally:
        db.close()

@app.route('/api/trips', methods=['POST'])
def create_trip():
    """Create a new trip"""
    data = request.json
    
    if not data.get('name'):
        return jsonify({'error': 'Trip name is required'}), 400
    
    db = get_db()
    try:
        trip = Trip(name=data['name'])

        # Handle start location
        start_address = data.get('start_location_address', '').strip()
        if start_address:
            trip.start_location_address = start_address
            coords = geocoding_service.geocode_address(start_address)
            if coords:
                trip.start_location_latitude, trip.start_location_longitude = round(coords[0], 4), round(coords[1], 4)

        # Handle end location
        end_address = data.get('end_location_address', '').strip()
        if end_address:
            trip.end_location_address = end_address
            coords = geocoding_service.geocode_address(end_address)
            if coords:
                trip.end_location_latitude, trip.end_location_longitude = round(coords[0], 4), round(coords[1], 4)

        db.add(trip)
        db.commit()
        db.refresh(trip)
        return jsonify(trip.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/trips/<int:trip_id>', methods=['GET'])
def get_trip(trip_id):
    """Get a specific trip with all stops"""
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        return jsonify(trip.to_dict(include_stops=True))
    finally:
        db.close()

@app.route('/api/trips/<int:trip_id>', methods=['PUT'])
def update_trip(trip_id):
    """Update a trip"""
    data = request.json

    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        if 'name' in data:
            trip.name = data['name']

        # Handle start location
        if 'start_location_address' in data:
            trip.start_location_address = data['start_location_address']
            if data['start_location_address']:
                # Geocode the address
                coords = geocoding_service.geocode_address(data['start_location_address'])
                if coords:
                    trip.start_location_latitude, trip.start_location_longitude = round(coords[0], 4), round(coords[1], 4)
            else:
                # Clear location if address is empty
                trip.start_location_latitude = None
                trip.start_location_longitude = None

        # Handle end location
        if 'end_location_address' in data:
            trip.end_location_address = data['end_location_address']
            if data['end_location_address']:
                # Geocode the address
                coords = geocoding_service.geocode_address(data['end_location_address'])
                if coords:
                    trip.end_location_latitude, trip.end_location_longitude = round(coords[0], 4), round(coords[1], 4)
            else:
                # Clear location if address is empty
                trip.end_location_latitude = None
                trip.end_location_longitude = None

        db.commit()
        db.refresh(trip)
        return jsonify(trip.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/trips/<int:trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    """Delete a trip"""
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        db.delete(trip)
        db.commit()
        return jsonify({'message': 'Trip deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# ============================================================================
# API Routes - Stops
# ============================================================================

@app.route('/api/trips/<int:trip_id>/stops', methods=['GET'])
def get_stops(trip_id):
    """Get all stops for a trip"""
    db = get_db()
    try:
        stops = db.query(Stop).filter(Stop.trip_id == trip_id).order_by(Stop.start_date).all()
        return jsonify([stop.to_dict(include_activities=True) for stop in stops])
    finally:
        db.close()

@app.route('/api/trips/<int:trip_id>/stops', methods=['POST'])
def create_stop(trip_id):
    """Create a new stop"""
    data = request.json
    
    # Validate required fields
    required_fields = ['name', 'start_date', 'end_date', 'location_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    db = get_db()
    try:
        # Check if trip exists
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        # Parse dates
        try:
            start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400
        
        # Validate dates
        if end_date < start_date:
            return jsonify({'error': 'End date must be after start date'}), 400
        
        # Find the previous location (last location in trip by order)
        previous_location = db.query(Location).filter(Location.trip_id == trip_id).order_by(Location.id.desc()).first()
        previous_location_guid = previous_location.guid if previous_location else None
        
        # Get the next order index
        max_order = db.query(Stop).filter(Stop.trip_id == trip_id).count()
        
        # Handle location
        latitude = None
        longitude = None
        address = None
        
        if data['location_type'] == 'gps':
            latitude = float(data.get('latitude'))
            longitude = float(data.get('longitude'))
            # Try to get address from coordinates
            address = geocoding_service.reverse_geocode(latitude, longitude)
        elif data['location_type'] == 'address':
            address = data.get('address')
            # Try to get coordinates from address
            coords = geocoding_service.geocode_address(address)
            if coords:
                latitude, longitude = coords
        
        # Create stop
        stop = Stop(
            trip_id=trip_id,
            name=data['name'],
            start_date=start_date,
            end_date=end_date,
            location_type=data['location_type'],
            latitude=latitude,
            longitude=longitude,
            address=address,
            previous_location_guid=previous_location_guid
        )
        
        db.add(stop)
        db.commit()
        db.refresh(stop)
        return jsonify(stop.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/stops/<int:stop_id>', methods=['GET'])
def get_stop(stop_id):
    """Get a specific stop"""
    db = get_db()
    try:
        stop = db.query(Stop).filter(Stop.id == stop_id).first()
        if not stop:
            return jsonify({'error': 'Stop not found'}), 404
        return jsonify(stop.to_dict(include_activities=True))
    finally:
        db.close()

@app.route('/api/stops/<int:stop_id>', methods=['PUT'])
def update_stop(stop_id):
    """Update a stop"""
    data = request.json
    
    db = get_db()
    try:
        stop = db.query(Stop).filter(Stop.id == stop_id).first()
        if not stop:
            return jsonify({'error': 'Stop not found'}), 404
        
        # Update fields
        if 'name' in data:
            stop.name = data['name']
        
        if 'start_date' in data:
            stop.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        
        if 'end_date' in data:
            stop.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        # Validate dates
        if stop.end_date < stop.start_date:
            return jsonify({'error': 'End date must be after start date'}), 400
        
        # Update location if provided
        if 'location_type' in data:
            stop.location_type = data['location_type']
            
            if data['location_type'] == 'gps' and 'latitude' in data and 'longitude' in data:
                stop.latitude = round(float(data['latitude']), 4)
                stop.longitude = round(float(data['longitude']), 4)
                # Try to get address
                address = geocoding_service.reverse_geocode(stop.latitude, stop.longitude)
                if address:
                    stop.address = address
            elif data['location_type'] == 'address' and 'address' in data:
                stop.address = data['address']
                # Try to get coordinates
                coords = geocoding_service.geocode_address(data['address'])
                if coords:
                    stop.latitude, stop.longitude = round(coords[0], 4), round(coords[1], 4)
        
        db.commit()
        db.refresh(stop)
        return jsonify(stop.to_dict(include_activities=True))
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/stops/<int:stop_id>', methods=['DELETE'])
def delete_stop(stop_id):
    """Delete a stop"""
    db = get_db()
    try:
        stop = db.query(Stop).filter(Stop.id == stop_id).first()
        if not stop:
            return jsonify({'error': 'Stop not found'}), 404
        
        db.delete(stop)
        db.commit()
        return jsonify({'message': 'Stop deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/stops/reorder', methods=['POST'])
def reorder_stops():
    """Reorder stops using location chain"""
    # With location chain (previous_location_guid), stops are ordered by their chain
    # This endpoint is no longer needed but kept for compatibility
    return jsonify({'message': 'Reordering is handled via location chain'})


# ============================================================================
# API Routes - Activities
# ============================================================================

@app.route('/api/stops/<int:stop_id>/activities', methods=['POST'])
def create_activity(stop_id):
    """Create a new activity"""
    data = request.json
    
    if not data.get('name'):
        return jsonify({'error': 'Activity name is required'}), 400
    
    db = get_db()
    try:
        # Check if stop exists
        stop = db.query(Stop).filter(Stop.id == stop_id).first()
        if not stop:
            return jsonify({'error': 'Stop not found'}), 404
        
        activity = Activity(
            stop_id=stop_id,
            name=data['name'],
            description=data.get('description', ''),
            url=data.get('url', '')
        )
        
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return jsonify(activity.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/activities/<int:activity_id>', methods=['PUT'])
def update_activity(activity_id):
    """Update an activity"""
    data = request.json
    
    db = get_db()
    try:
        activity = db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return jsonify({'error': 'Activity not found'}), 404
        
        if 'name' in data:
            activity.name = data['name']
        if 'description' in data:
            activity.description = data['description']
        if 'url' in data:
            activity.url = data['url']
        
        db.commit()
        db.refresh(activity)
        return jsonify(activity.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/activities/<int:activity_id>', methods=['DELETE'])
def delete_activity(activity_id):
    """Delete an activity"""
    db = get_db()
    try:
        activity = db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return jsonify({'error': 'Activity not found'}), 404
        
        db.delete(activity)
        db.commit()
        return jsonify({'message': 'Activity deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# ============================================================================
# API Routes - Waypoints
# ============================================================================

@app.route('/api/trips/<int:trip_id>/waypoints', methods=['GET'])
def get_waypoints(trip_id):
    """Get all waypoints for a trip"""
    db = get_db()
    try:
        waypoints = db.query(Waypoint).filter(Waypoint.trip_id == trip_id).all()
        return jsonify([wp.to_dict() for wp in waypoints])
    finally:
        db.close()

@app.route('/api/trips/<int:trip_id>/waypoints', methods=['POST'])
def create_waypoint(trip_id):
    """Create a new waypoint"""
    data = request.json

    required_fields = ['name', 'location_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    db = get_db()
    try:
        # Check if trip exists
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Handle location
        latitude = None
        longitude = None
        address = None

        if data['location_type'] == 'gps':
            if 'latitude' not in data or 'longitude' not in data:
                return jsonify({'error': 'latitude and longitude are required for GPS location type'}), 400
            latitude = round(float(data['latitude']), 4)
            longitude = round(float(data['longitude']), 4)
            # Try to get address from coordinates
            address = geocoding_service.reverse_geocode(latitude, longitude)
        elif data['location_type'] == 'address':
            address = data.get('address')
            # Try to get coordinates from address
            coords = geocoding_service.geocode_address(address)
            if coords:
                latitude, longitude = round(coords[0], 4), round(coords[1], 4)

        # Use provided previous_location_guid or fall back to auto-detection
        previous_location_guid = data.get('previous_location_guid')
        if previous_location_guid is None:
            # Fall back to auto-detecting the last location in trip
            previous_location = db.query(Location).filter(Location.trip_id == trip_id).order_by(Location.id.desc()).first()
            previous_location_guid = previous_location.guid if previous_location else None

        # Create waypoint
        waypoint = Waypoint(
            trip_id=trip_id,
            name=data['name'],
            location_type=data['location_type'],
            latitude=latitude,
            longitude=longitude,
            address=address,
            previous_location_guid=previous_location_guid
        )

        db.add(waypoint)
        db.commit()
        db.refresh(waypoint)
        return jsonify(waypoint.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/waypoints/<int:waypoint_id>', methods=['PUT'])
def update_waypoint(waypoint_id):
    """Update a waypoint"""
    data = request.json

    db = get_db()
    try:
        waypoint = db.query(Waypoint).filter(Waypoint.id == waypoint_id).first()
        if not waypoint:
            return jsonify({'error': 'Waypoint not found'}), 404

        # Update fields
        if 'name' in data:
            waypoint.name = data['name']

        # Update location if provided
        if 'location_type' in data:
            waypoint.location_type = data['location_type']

            if data['location_type'] == 'gps' and 'latitude' in data and 'longitude' in data:
                waypoint.latitude = round(float(data['latitude']), 4)
                waypoint.longitude = round(float(data['longitude']), 4)
                # Try to get address
                address = geocoding_service.reverse_geocode(waypoint.latitude, waypoint.longitude)
                if address:
                    waypoint.address = address
            elif data['location_type'] == 'address' and 'address' in data:
                waypoint.address = data['address']
                # Try to get coordinates
                coords = geocoding_service.geocode_address(data['address'])
                if coords:
                    waypoint.latitude, waypoint.longitude = round(coords[0], 4), round(coords[1], 4)

        db.commit()
        db.refresh(waypoint)
        return jsonify(waypoint.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/waypoints/<int:waypoint_id>', methods=['DELETE'])
def delete_waypoint(waypoint_id):
    """Delete a waypoint"""
    db = get_db()
    try:
        waypoint = db.query(Waypoint).filter(Waypoint.id == waypoint_id).first()
        if not waypoint:
            return jsonify({'error': 'Waypoint not found'}), 404

        db.delete(waypoint)
        db.commit()
        return jsonify({'message': 'Waypoint deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# ============================================================================
# API Routes - Routing
# ============================================================================

@app.route('/api/trips/<int:trip_id>/route', methods=['GET'])
def get_trip_route(trip_id):
    """Calculate route and distances for a trip"""
    db = get_db()
    try:
        # Get trip
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Get all locations for the trip
        all_locations = db.query(Location).filter(Location.trip_id == trip_id).all()

        if not all_locations:
            return jsonify({'error': 'No locations found for this trip'}), 404

        # Create a map of GUIDs to locations for quick lookup
        location_map = {loc.guid: loc for loc in all_locations}
        
        # Find the end location (one that no other location points to)
        guids_referenced = {loc.previous_location_guid for loc in all_locations if loc.previous_location_guid}
        end_location = None
        for loc in all_locations:
            if loc.guid not in guids_referenced:
                end_location = loc
                break
        
        if not end_location:
            return jsonify({'error': 'Could not determine route (invalid location chain)'}), 400

        # Traverse backwards from end to start
        all_points = []
        current = end_location
        
        while current:
            # Validate location has coordinates
            if not current.latitude or not current.longitude:
                return jsonify({
                    'error': f'Location "{current.name}" does not have valid coordinates'
                }), 400
            
            # Build point data based on location type
            if isinstance(current, Stop):
                point_data = current.to_dict(include_activities=False)
            else:
                point_data = current.to_dict()
            
            # Ensure it has the required fields for routing
            point_data['latitude'] = current.latitude
            point_data['longitude'] = current.longitude
            all_points.append(point_data)
            
            # Get the previous location
            if current.previous_location_guid:
                current = location_map.get(current.previous_location_guid)
            else:
                current = None
        
        # Reverse to get start-to-end order
        all_points.reverse()

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

        # Calculate route
        route_info = route_service.calculate_route(all_points)

        return jsonify(route_info)
    finally:
        db.close()


# ============================================================================
# API Routes - Validation
# ============================================================================
# API Routes - Locations
# ============================================================================

@app.route('/api/trips/<int:trip_id>/locations', methods=['GET'])
def get_trip_locations(trip_id):
    """Get all locations for a trip in reverse order (from end to start)"""
    db = get_db()
    try:
        # Check if trip exists
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        # Find the last location (no next location pointing to it)
        locations = []
        
        # Get all locations for this trip
        all_locations = db.query(Location).filter(Location.trip_id == trip_id).all()
        
        if not all_locations:
            return jsonify([])
        
        # Create a map of GUIDs to locations for quick lookup
        location_map = {loc.guid: loc for loc in all_locations}
        
        # Find the end location (one that no other location points to)
        guids_referenced = {loc.previous_location_guid for loc in all_locations if loc.previous_location_guid}
        end_location = None
        for loc in all_locations:
            if loc.guid not in guids_referenced:
                end_location = loc
                break
        
        # Traverse backwards from end to start
        current = end_location
        while current:
            location_data = None
            if isinstance(current, Stop):
                location_data = current.to_dict(include_activities=False)
            else:
                location_data = current.to_dict()
            locations.append(location_data)
            
            # Get the previous location
            if current.previous_location_guid:
                current = location_map.get(current.previous_location_guid)
            else:
                current = None
        
        return jsonify(locations)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# ============================================================================
# API Routes - Validation
# ============================================================================

@app.route('/api/validate-address', methods=['POST'])
def validate_address():
    """Validate an address by attempting to geocode it"""
    data = request.json

    if not data or not data.get('address'):
        return jsonify({'valid': False, 'error': 'Address is required'}), 400

    address = data['address'].strip()

    if not address:
        return jsonify({'valid': False, 'error': 'Address cannot be empty'}), 400

    # Try to geocode the address
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


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


# ============================================================================
# Main
# ============================================================================

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=Config.DEBUG)
