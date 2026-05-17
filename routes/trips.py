from flask import Blueprint, request, jsonify
from models import Trip, Stop, AiPrompt, get_db
from helpers import geocode_trip_location
import uuid

trips_bp = Blueprint('trips', __name__, url_prefix='/api')


@trips_bp.route('/trips', methods=['GET'])
def get_trips():
    """Get all trips"""
    db = get_db()
    try:
        trips = db.query(Trip).all()
        return jsonify([trip.to_dict(include_stops=True) for trip in trips])
    finally:
        db.close()


@trips_bp.route('/trips', methods=['POST'])
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
            trip.start_location_guid = str(uuid.uuid4())
            trip.start_location_latitude, trip.start_location_longitude = geocode_trip_location(start_address)

        # Handle end location
        end_address = data.get('end_location_address', '').strip()
        if end_address:
            trip.end_location_address = end_address
            trip.end_location_guid = str(uuid.uuid4())
            trip.end_location_latitude, trip.end_location_longitude = geocode_trip_location(end_address)

        db.add(trip)
        db.commit()
        db.refresh(trip)
        return jsonify(trip.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@trips_bp.route('/trips/quick', methods=['POST'])
def create_quick_trip():
    """Create a trip with an ordered list of stops — no dates required."""
    data = request.json
    if not data.get('name'):
        return jsonify({'error': 'Trip name is required'}), 400

    stops_data = data.get('stops', [])
    if not stops_data:
        return jsonify({'error': 'At least one stop is required'}), 400

    db = get_db()
    try:
        trip = Trip(name=data['name'])
        db.add(trip)
        db.flush()  # obtain trip.id before creating stops

        prev_guid = None
        for s in stops_data:
            name = (s.get('name') or '').strip()
            if not name:
                db.rollback()
                return jsonify({'error': 'Each stop must have a name'}), 400

            address = (s.get('address') or '').strip() or None
            location_type = s.get('location_type', 'address')
            lat = s.get('latitude')
            lng = s.get('longitude')

            if location_type == 'gps' and lat is not None and lng is not None:
                lat, lng = float(lat), float(lng)
            elif address:
                coords = geocode_trip_location(address)
                lat, lng = coords if coords else (None, None)
            else:
                lat, lng = None, None

            stop = Stop(
                trip_id=trip.id,
                name=name,
                location_type=location_type,
                address=address,
                latitude=lat,
                longitude=lng,
                previous_location_guid=prev_guid,
            )
            db.add(stop)
            db.flush()  # obtain stop.guid for next iteration
            prev_guid = stop.guid

        db.commit()
        db.refresh(trip)
        return jsonify(trip.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@trips_bp.route('/trips/<int:trip_id>', methods=['GET'])
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


@trips_bp.route('/trips/<int:trip_id>', methods=['PUT'])
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
                if not trip.start_location_guid:
                    trip.start_location_guid = str(uuid.uuid4())
                trip.start_location_latitude, trip.start_location_longitude = geocode_trip_location(data['start_location_address'])
            else:
                trip.start_location_latitude = None
                trip.start_location_longitude = None
                trip.start_location_guid = None

        # Handle end location
        if 'end_location_address' in data:
            trip.end_location_address = data['end_location_address']
            if data['end_location_address']:
                if not trip.end_location_guid:
                    trip.end_location_guid = str(uuid.uuid4())
                trip.end_location_latitude, trip.end_location_longitude = geocode_trip_location(data['end_location_address'])
            else:
                trip.end_location_latitude = None
                trip.end_location_longitude = None
                trip.end_location_guid = None

        db.commit()
        db.refresh(trip)
        return jsonify(trip.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@trips_bp.route('/trips/<int:trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    """Delete a trip"""
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Nullify FK on ai_prompts before deleting (works for both SQLite and PostgreSQL)
        db.query(AiPrompt).filter(AiPrompt.trip_id == trip_id).update({'trip_id': None})
        db.delete(trip)
        db.commit()
        return jsonify({'message': 'Trip deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
