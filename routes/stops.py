from flask import Blueprint, request, jsonify
from models import Trip, Stop, Location, get_db
from helpers import parse_iso_date, geocode_location_fields

stops_bp = Blueprint('stops', __name__, url_prefix='/api')


@stops_bp.route('/trips/<int:trip_id>/stops', methods=['GET'])
def get_stops(trip_id):
    """Get all stops for a trip"""
    db = get_db()
    try:
        stops = db.query(Stop).filter(Stop.trip_id == trip_id).order_by(Stop.start_date).all()
        return jsonify([stop.to_dict(include_activities=True) for stop in stops])
    finally:
        db.close()


@stops_bp.route('/trips/<int:trip_id>/stops', methods=['POST'])
def create_stop(trip_id):
    """Create a new stop"""
    data = request.json

    required_fields = ['name', 'start_date', 'end_date', 'location_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Parse dates
        try:
            start_date = parse_iso_date(data['start_date'])
            end_date = parse_iso_date(data['end_date'])
        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400

        if end_date < start_date:
            return jsonify({'error': 'End date must be after start date'}), 400

        # Find the previous location
        previous_location = db.query(Location).filter(Location.trip_id == trip_id).order_by(Location.id.desc()).first()
        previous_location_guid = previous_location.guid if previous_location else None

        # Handle location
        latitude, longitude, address = geocode_location_fields(data)

        stop = Stop(
            trip_id=trip_id,
            name=data['name'],
            start_date=start_date,
            end_date=end_date,
            location_type=data['location_type'],
            latitude=latitude,
            longitude=longitude,
            address=address,
            description=data.get('description', ''),
            url=data.get('url', ''),
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


@stops_bp.route('/stops/<int:stop_id>', methods=['GET'])
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


@stops_bp.route('/stops/<int:stop_id>', methods=['PUT'])
def update_stop(stop_id):
    """Update a stop"""
    data = request.json

    db = get_db()
    try:
        stop = db.query(Stop).filter(Stop.id == stop_id).first()
        if not stop:
            return jsonify({'error': 'Stop not found'}), 404

        if 'name' in data:
            stop.name = data['name']
        if 'description' in data:
            stop.description = data['description']
        if 'url' in data:
            stop.url = data['url']

        if 'start_date' in data:
            stop.start_date = parse_iso_date(data['start_date'])

        if 'end_date' in data:
            stop.end_date = parse_iso_date(data['end_date'])

        if stop.end_date < stop.start_date:
            return jsonify({'error': 'End date must be after start date'}), 400

        # Update location if provided
        if 'location_type' in data:
            stop.location_type = data['location_type']
            lat, lng, addr = geocode_location_fields(data)
            if lat is not None:
                stop.latitude = lat
                stop.longitude = lng
            if addr is not None:
                stop.address = addr

        db.commit()
        db.refresh(stop)
        return jsonify(stop.to_dict(include_activities=True))
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@stops_bp.route('/stops/<int:stop_id>', methods=['DELETE'])
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


@stops_bp.route('/stops/reorder', methods=['POST'])
def reorder_stops():
    """Reorder stops using location chain"""
    return jsonify({'message': 'Reordering is handled via location chain'})
