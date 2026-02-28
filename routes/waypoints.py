from flask import Blueprint, request, jsonify
from models import Trip, Waypoint, Location, get_db
from helpers import geocode_location_fields

waypoints_bp = Blueprint('waypoints', __name__, url_prefix='/api')


@waypoints_bp.route('/trips/<int:trip_id>/waypoints', methods=['GET'])
def get_waypoints(trip_id):
    """Get all waypoints for a trip"""
    db = get_db()
    try:
        waypoints = db.query(Waypoint).filter(Waypoint.trip_id == trip_id).all()
        return jsonify([wp.to_dict() for wp in waypoints])
    finally:
        db.close()


@waypoints_bp.route('/trips/<int:trip_id>/waypoints', methods=['POST'])
def create_waypoint(trip_id):
    """Create a new waypoint"""
    data = request.json

    required_fields = ['name', 'location_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Handle location
        if data['location_type'] == 'gps' and ('latitude' not in data or 'longitude' not in data):
            return jsonify({'error': 'latitude and longitude are required for GPS location type'}), 400
        latitude, longitude, address = geocode_location_fields(data)

        # Use provided previous_location_guid or fall back to auto-detection
        previous_location_guid = data.get('previous_location_guid')
        if previous_location_guid is None:
            previous_location = db.query(Location).filter(Location.trip_id == trip_id).order_by(Location.id.desc()).first()
            previous_location_guid = previous_location.guid if previous_location else None

        waypoint = Waypoint(
            trip_id=trip_id,
            name=data['name'],
            location_type=data['location_type'],
            latitude=latitude,
            longitude=longitude,
            address=address,
            description=data.get('description', ''),
            url=data.get('url', ''),
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


@waypoints_bp.route('/waypoints/<int:waypoint_id>', methods=['PUT'])
def update_waypoint(waypoint_id):
    """Update a waypoint"""
    data = request.json

    db = get_db()
    try:
        waypoint = db.query(Waypoint).filter(Waypoint.id == waypoint_id).first()
        if not waypoint:
            return jsonify({'error': 'Waypoint not found'}), 404

        if 'name' in data:
            waypoint.name = data['name']
        if 'description' in data:
            waypoint.description = data['description']
        if 'url' in data:
            waypoint.url = data['url']

        # Update location if provided
        if 'location_type' in data:
            waypoint.location_type = data['location_type']
            lat, lng, addr = geocode_location_fields(data)
            if lat is not None:
                waypoint.latitude = lat
                waypoint.longitude = lng
            if addr is not None:
                waypoint.address = addr

        db.commit()
        db.refresh(waypoint)
        return jsonify(waypoint.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@waypoints_bp.route('/waypoints/<int:waypoint_id>', methods=['DELETE'])
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
