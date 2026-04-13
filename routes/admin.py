from flask import Blueprint, request, jsonify, render_template
from datetime import datetime
from models import Trip, Location, Activity, get_db
from helpers import get_ordered_locations
from sqlalchemy import inspect as sa_inspect

admin_bp = Blueprint('admin', __name__)

ADMIN_MODELS = {
    'trip': Trip,
    'location': Location,
    'activity': Activity,
}


@admin_bp.route('/admin')
@admin_bp.route('/admin/entities')
def admin_entities():
    return render_template('admin.html', active_tab='entities')

@admin_bp.route('/admin/backup')
def admin_backup():
    return render_template('admin.html', active_tab='backup')

@admin_bp.route('/admin/ordering')
def admin_ordering():
    trip_id = request.args.get('trip', type=int)
    return render_template('admin.html', active_tab='ordering', preselect_trip_id=trip_id)


@admin_bp.route('/api/admin/entities', methods=['GET'])
def get_entity_types():
    """Get all available entity types and their column names"""
    result = {}
    for name, model in ADMIN_MODELS.items():
        mapper = sa_inspect(model)
        columns = [col.key for col in mapper.column_attrs]
        result[name] = columns
    return jsonify(result)


@admin_bp.route('/api/admin/<entity_type>', methods=['GET'])
def get_all_entities(entity_type):
    """Get all instances of a given entity type"""
    model = ADMIN_MODELS.get(entity_type)
    if not model:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 400

    db = get_db()
    try:
        mapper = sa_inspect(model)
        columns = [col.key for col in mapper.column_attrs]
        items = db.query(model).all()
        result = []
        for item in items:
            row = {}
            for col in columns:
                val = getattr(item, col, None)
                if isinstance(val, datetime):
                    val = val.isoformat()
                elif isinstance(val, (bytes, bytearray)):
                    val = f'<binary: {len(val):,} bytes>'
                row[col] = val
            result.append(row)
        return jsonify({'columns': columns, 'rows': result})
    finally:
        db.close()


@admin_bp.route('/api/admin/chain/trips', methods=['GET'])
def get_trips_for_chain():
    """List all trips (id + name) for the Stop-Link Fix dropdown."""
    db = get_db()
    try:
        trips = db.query(Trip).order_by(Trip.name).all()
        return jsonify([{'id': t.id, 'name': t.name} for t in trips])
    finally:
        db.close()


@admin_bp.route('/api/admin/chain/trips/<int:trip_id>/locations', methods=['GET'])
def get_chain_locations(trip_id):
    """Return ALL locations for a trip: chain-ordered first, then any unreachable ones.

    get_ordered_locations() silently drops locations that are unreachable due to
    chain forks (two locations claiming the same predecessor). This endpoint appends
    those stranded locations at the end so nothing is hidden from the ordering screen.
    """
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        ordered = get_ordered_locations(db, trip_id)
        seen_guids = {loc.guid for loc in ordered}

        # Fetch every location for this trip and append any not reached by the walk
        all_locs = db.query(Location).filter(Location.trip_id == trip_id).all()
        stranded = [loc for loc in all_locs if loc.guid not in seen_guids]

        def loc_dict(loc, unreachable=False):
            return {
                'id': loc.id,
                'guid': loc.guid,
                'type': loc.type,
                'name': loc.name,
                'start_date': loc.start_date.isoformat() if loc.start_date else None,
                'end_date': loc.end_date.isoformat() if loc.end_date else None,
                'previous_location_guid': loc.previous_location_guid,
                'unreachable': unreachable,
            }

        result = [loc_dict(loc) for loc in ordered]
        result += [loc_dict(loc, unreachable=True) for loc in stranded]
        return jsonify(result)
    finally:
        db.close()


@admin_bp.route('/api/admin/chain/trips/<int:trip_id>/rechain', methods=['POST'])
def rechain_locations(trip_id):
    """Rebuild the previous_location_guid chain in a new order, with optional deletions.

    Accepts {
        guids: [guid1, guid2, ...],   -- locations in desired order (excluded deleted ones)
        delete_ids: [id1, id2, ...]   -- location IDs to delete (optional)
    }
    Deletions are applied first, then the chain is rebuilt from the remaining guids.
    """
    data = request.json or {}
    guids = data.get('guids', [])
    delete_ids = data.get('delete_ids', [])

    if not guids and not delete_ids:
        return jsonify({'error': 'guids or delete_ids is required'}), 400

    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        # Delete staged locations first (cascade removes activities)
        deleted = []
        for loc_id in delete_ids:
            loc = db.query(Location).filter(
                Location.id == loc_id, Location.trip_id == trip_id
            ).first()
            if not loc:
                return jsonify({'error': f'Location {loc_id} not found in trip'}), 404
            deleted.append({'name': loc.name, 'type': loc.type})
            db.delete(loc)
        db.flush()

        if not guids:
            db.commit()
            return jsonify({'deleted': deleted, 'changes': [], 'total': len(deleted)})

        # Load remaining locations keyed by guid
        all_locs = db.query(Location).filter(Location.trip_id == trip_id).all()
        loc_by_guid = {loc.guid: loc for loc in all_locs}

        for g in guids:
            if g not in loc_by_guid:
                return jsonify({'error': f'Unknown guid: {g}'}), 400

        # Rebuild chain
        changes = []
        for i, guid in enumerate(guids):
            loc = loc_by_guid[guid]
            new_prev = guids[i - 1] if i > 0 else None
            if loc.previous_location_guid != new_prev:
                changes.append({
                    'name': loc.name,
                    'type': loc.type,
                    'old_prev_guid': loc.previous_location_guid,
                    'new_prev_guid': new_prev,
                })
                loc.previous_location_guid = new_prev

        db.commit()
        return jsonify({'deleted': deleted, 'changes': changes, 'total': len(deleted) + len(changes)})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@admin_bp.route('/api/admin/<entity_type>/<int:entity_id>', methods=['DELETE'])
def delete_entity(entity_type, entity_id):
    """Delete an entity by type and ID"""
    model = ADMIN_MODELS.get(entity_type)
    if not model:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 400

    db = get_db()
    try:
        item = db.query(model).filter(model.id == entity_id).first()
        if not item:
            return jsonify({'error': f'{entity_type} with id {entity_id} not found'}), 404
        db.delete(item)
        db.commit()
        return jsonify({'message': f'{entity_type} {entity_id} deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
