from flask import Blueprint, request, jsonify
from models import Trip, Stop, Location, get_db
from helpers import parse_iso_date, geocode_location_fields, get_ordered_locations

stops_bp = Blueprint('stops', __name__, url_prefix='/api')


@stops_bp.route('/trips/<int:trip_id>/stops', methods=['GET'])
def get_stops(trip_id):
    """Get all stops for a trip in chain order"""
    db = get_db()
    try:
        ordered = get_ordered_locations(db, trip_id)
        stops = [loc for loc in ordered if isinstance(loc, Stop)]
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

        # Get the previous location GUID from the request or from the last location
        previous_location_guid = data.get('previous_location_guid')
        if previous_location_guid is None:
            # Only set previous_location_guid if there are existing locations in this trip
            previous_location = db.query(Location).filter(Location.trip_id == trip_id).order_by(Location.id.desc()).first()
            previous_location_guid = previous_location.guid if previous_location else None
        
        # Validate that the previous_location_guid actually exists in locations table
        # If it's the trip's start_location_guid or doesn't exist, set to NULL
        if previous_location_guid:
            location_exists = db.query(Location).filter(
                Location.trip_id == trip_id,
                Location.guid == previous_location_guid
            ).first()
            if not location_exists:
                previous_location_guid = None

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

        # If we inserted this stop between two existing locations,
        # update the stop that comes after to point to the new stop
        if previous_location_guid:
            # Find the location that currently points to after this stop
            next_location = db.query(Location).filter(
                Location.trip_id == trip_id,
                Location.previous_location_guid == previous_location_guid,
                Location.id != stop.id
            ).first()
            
            if next_location:
                # Update the next location to point to the newly inserted stop
                next_location.previous_location_guid = stop.guid
                db.commit()

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

        if stop.end_date is not None and stop.start_date is not None and stop.end_date < stop.start_date:
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


@stops_bp.route('/trips/<int:trip_id>/reorder', methods=['POST'])
def reorder_trip_stops(trip_id):
    """Reorder stops by rebuilding the previous_location_guid chain.

    Accepts { stop_ids: [id1, id2, ...] } in the desired new order.
    Waypoints stay attached to their stop: each stop's previous_location_guid
    is updated to point to the tail of the previous stop's waypoint segment.
    """
    data = request.json
    stop_ids = data.get('stop_ids', [])

    if not stop_ids:
        return jsonify({'error': 'stop_ids is required'}), 400

    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Fetch stops in the requested order, validating they belong to this trip
        stops = []
        for sid in stop_ids:
            stop = db.query(Stop).filter(Stop.id == sid, Stop.trip_id == trip_id).first()
            if not stop:
                return jsonify({'error': f'Stop {sid} not found in trip'}), 404
            stops.append(stop)

        # Build a forward map across all locations so we can walk waypoint tails
        all_locs = db.query(Location).filter(Location.trip_id == trip_id).all()
        guids_in_trip = {loc.guid for loc in all_locs}
        next_map = {}
        for loc in all_locs:
            prev = loc.previous_location_guid
            if prev and prev in guids_in_trip and prev not in next_map:
                next_map[prev] = loc

        def get_segment_tail_guid(stop):
            """Walk forward through waypoints after this stop; return guid of last node."""
            current_guid = stop.guid
            while current_guid in next_map:
                nxt = next_map[current_guid]
                if isinstance(nxt, Stop):
                    break  # Don't cross into the next stop
                current_guid = nxt.guid
            return current_guid

        # Rebuild the stop chain in the new order
        for i, stop in enumerate(stops):
            if i == 0:
                stop.previous_location_guid = None
            else:
                stop.previous_location_guid = get_segment_tail_guid(stops[i - 1])

        db.commit()
        return jsonify({'message': 'Stops reordered successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@stops_bp.route('/stops/reorder', methods=['POST'])
def reorder_stops():
    """Legacy stub — use /api/trips/<id>/reorder instead"""
    return jsonify({'message': 'Use /api/trips/<id>/reorder'})
