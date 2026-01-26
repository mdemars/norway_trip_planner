from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from datetime import datetime
from config import Config
from models import Trip, Stop, Activity, Waypoint, init_db, get_db
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
                    trip.start_location_latitude, trip.start_location_longitude = coords
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
                    trip.end_location_latitude, trip.end_location_longitude = coords
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
        stops = db.query(Stop).filter(Stop.trip_id == trip_id).order_by(Stop.start_date, Stop.order_index).all()
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
            order_index=max_order
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
                stop.latitude = float(data['latitude'])
                stop.longitude = float(data['longitude'])
                # Try to get address
                address = geocoding_service.reverse_geocode(stop.latitude, stop.longitude)
                if address:
                    stop.address = address
            elif data['location_type'] == 'address' and 'address' in data:
                stop.address = data['address']
                # Try to get coordinates
                coords = geocoding_service.geocode_address(data['address'])
                if coords:
                    stop.latitude, stop.longitude = coords
        
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
        
        trip_id = stop.trip_id
        order_index = stop.order_index
        
        db.delete(stop)
        
        # Reorder remaining stops
        remaining_stops = db.query(Stop).filter(
            Stop.trip_id == trip_id,
            Stop.order_index > order_index
        ).all()
        
        for s in remaining_stops:
            s.order_index -= 1
        
        db.commit()
        return jsonify({'message': 'Stop deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/stops/reorder', methods=['POST'])
def reorder_stops():
    """Reorder stops"""
    data = request.json
    stop_orders = data.get('stops', [])  # List of {id, order_index}
    
    db = get_db()
    try:
        for item in stop_orders:
            stop = db.query(Stop).filter(Stop.id == item['id']).first()
            if stop:
                stop.order_index = item['order_index']
        
        db.commit()
        return jsonify({'message': 'Stops reordered successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


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
        waypoints = db.query(Waypoint).filter(Waypoint.trip_id == trip_id).order_by(Waypoint.order_index).all()
        return jsonify([wp.to_dict() for wp in waypoints])
    finally:
        db.close()

@app.route('/api/trips/<int:trip_id>/waypoints', methods=['POST'])
def create_waypoint(trip_id):
    """Create a new waypoint"""
    data = request.json

    required_fields = ['name', 'order_index', 'location_type']
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

        # Create waypoint
        waypoint = Waypoint(
            trip_id=trip_id,
            name=data['name'],
            order_index=float(data['order_index']),
            location_type=data['location_type'],
            latitude=latitude,
            longitude=longitude,
            address=address
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
                waypoint.latitude = float(data['latitude'])
                waypoint.longitude = float(data['longitude'])
                # Try to get address
                address = geocoding_service.reverse_geocode(waypoint.latitude, waypoint.longitude)
                if address:
                    waypoint.address = address
            elif data['location_type'] == 'address' and 'address' in data:
                waypoint.address = data['address']
                # Try to get coordinates
                coords = geocoding_service.geocode_address(data['address'])
                if coords:
                    waypoint.latitude, waypoint.longitude = coords

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

        # Get all stops and waypoints for the trip
        stops = db.query(Stop).filter(Stop.trip_id == trip_id).order_by(Stop.start_date, Stop.order_index).all()
        waypoints = db.query(Waypoint).filter(Waypoint.trip_id == trip_id).order_by(Waypoint.order_index).all()

        if not stops:
            return jsonify({'error': 'No stops found for this trip'}), 404

        # Merge stops and waypoints, sorted by order_index
        all_points = []

        # Add start location if it exists
        if trip.start_location_latitude and trip.start_location_longitude:
            # Get the first stop's start date for the trip start
            trip_start_date = stops[0].start_date if stops else None
            all_points.append({
                'id': 'start',
                'name': 'Trip Start',
                'latitude': trip.start_location_latitude,
                'longitude': trip.start_location_longitude,
                'address': trip.start_location_address,
                'order_index': -1,
                'type': 'start',
                'start_date': trip_start_date.isoformat() if trip_start_date else None
            })

        for stop in stops:
            if stop.latitude and stop.longitude:
                point_data = stop.to_dict()
                point_data['type'] = 'stop'
                all_points.append(point_data)
            else:
                return jsonify({
                    'error': f'Stop "{stop.name}" does not have valid coordinates'
                }), 400

        for waypoint in waypoints:
            if waypoint.latitude and waypoint.longitude:
                point_data = waypoint.to_dict()
                point_data['type'] = 'waypoint'
                all_points.append(point_data)
            else:
                return jsonify({
                    'error': f'Waypoint "{waypoint.name}" does not have valid coordinates'
                }), 400

        # Add end location if it exists
        if trip.end_location_latitude and trip.end_location_longitude:
            # Get the last stop's end date for the trip end
            trip_end_date = stops[-1].end_date if stops else None
            all_points.append({
                'id': 'end',
                'name': 'Trip End',
                'latitude': trip.end_location_latitude,
                'longitude': trip.end_location_longitude,
                'address': trip.end_location_address,
                'order_index': 9999,
                'type': 'end',
                'start_date': trip_end_date.isoformat() if trip_end_date else None
            })

        # Sort by order_index
        all_points.sort(key=lambda x: x['order_index'])

        # Calculate route
        route_info = route_service.calculate_route(all_points)

        return jsonify(route_info)
    finally:
        db.close()


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
