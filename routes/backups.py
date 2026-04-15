from flask import Blueprint, request, jsonify, send_file
from pathlib import Path
from backup_db import create_backup, restore_backup, list_backups, DEFAULT_BACKUP_DIR, DEFAULT_DB_PATH
import io
import json
import os
import zipfile
from datetime import datetime, timezone
import uuid as uuid_module
from models import Trip, Stop, Activity, get_db
from helpers import parse_iso_date
from werkzeug.utils import secure_filename

backups_bp = Blueprint('backups', __name__, url_prefix='/api')


@backups_bp.route('/backups', methods=['GET'])
def get_backups():
    """List all available database backups."""
    backups = list_backups()
    return jsonify(backups)


@backups_bp.route('/backup', methods=['POST'])
def trigger_backup():
    """
    Create a database backup.
    Optional JSON body:
      { "backup_dir": "backups", "max_backups": 7, "filename_pattern": "database_backup_{timestamp}.db" }
    """
    data = request.json or {}
    backup_dir = Path(data.get('backup_dir', DEFAULT_BACKUP_DIR))
    max_backups = int(data.get('max_backups', 7))
    filename_pattern = data.get('filename_pattern', 'database_backup_{timestamp}.db')

    try:
        dest = create_backup(
            db_path=DEFAULT_DB_PATH,
            backup_dir=backup_dir,
            filename_pattern=filename_pattern,
            max_backups=max_backups,
        )
        return jsonify({'message': 'Backup created', 'path': str(dest), 'filename': dest.name}), 201
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@backups_bp.route('/restore', methods=['POST'])
def trigger_restore():
    """
    Restore database from a backup file.
    Required JSON body: { "path": "backups/database_backup_2025-01-01_020000.db" }
    """
    data = request.json or {}
    backup_path = data.get('path')
    if not backup_path:
        return jsonify({'error': 'path is required'}), 400

    try:
        restore_backup(backup_path=Path(backup_path))
        return jsonify({'message': f'Database restored from {backup_path}'})
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@backups_bp.route('/backup/download/<filename>', methods=['GET'])
def download_backup(filename):
    """
    Download a backup file to the user's local machine.
    Filename must be a valid backup filename.
    """
    # Security: validate filename to prevent directory traversal
    if not filename.startswith('database_backup_') or not filename.endswith('.db'):
        return jsonify({'error': 'Invalid backup filename'}), 400

    backup_path = DEFAULT_BACKUP_DIR / filename
    
    if not backup_path.exists():
        return jsonify({'error': 'Backup file not found'}), 404

    try:
        return send_file(
            backup_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/x-sqlite3'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@backups_bp.route('/backup/upload', methods=['POST'])
def upload_backup():
    """
    Upload a backup file from local machine and optionally restore it.
    Form data:
      - file: The backup file to upload
      - restore: (optional) 'true' to restore immediately after upload
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Validate file
    if not file.filename.endswith('.db'):
        return jsonify({'error': 'Only .db files are allowed'}), 400

    # Create a safe filename
    safe_filename = secure_filename(file.filename)
    if not safe_filename:
        safe_filename = 'uploaded_backup.db'

    # Ensure backup directory exists
    backup_dir = Path(DEFAULT_BACKUP_DIR)
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Save the uploaded file
    uploaded_path = backup_dir / safe_filename

    try:
        file.save(str(uploaded_path))
        
        result = {
            'message': f'Backup uploaded: {safe_filename}',
            'filename': safe_filename,
            'path': str(uploaded_path)
        }

        # If restore is requested, restore from the uploaded backup
        restore_requested = request.form.get('restore', '').lower() == 'true'
        if restore_requested:
            restore_backup(backup_path=uploaded_path)
            result['message'] += ' and restored'
            result['restored'] = True

        return jsonify(result), 201
    except Exception as e:
        # Clean up the uploaded file if something goes wrong
        if uploaded_path.exists():
            uploaded_path.unlink()
        return jsonify({'error': str(e)}), 500


@backups_bp.route('/export/json', methods=['GET'])
def export_json():
    """
    Export all trips as a ZIP file containing one JSON file per trip.
    Each JSON includes the trip's stops (with activities).
    """
    db = get_db()
    try:
        trips = db.query(Trip).all()

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for trip in trips:
                trip_data = trip.to_dict(include_stops=True)

                safe_name = ''.join(c if c.isalnum() or c in ' -_' else '_' for c in trip.name)[:50].strip()
                filename = f"trip_{trip.id}_{safe_name}.json"
                zf.writestr(filename, json.dumps(trip_data, indent=2))

        zip_buffer.seek(0)
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        return send_file(
            zip_buffer,
            as_attachment=True,
            download_name=f"trips_export_{timestamp}.zip",
            mimetype='application/zip'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@backups_bp.route('/import/trip', methods=['POST'])
def import_trip():
    """
    Import a trip from a JSON file produced by /api/export/json.

    All database IDs are regenerated so nothing conflicts with existing data.
    GUIDs are also regenerated (they have a unique constraint) but the
    previous_location_guid chain structure is preserved via a guid mapping.
    """
    data = request.json
    if not data or 'name' not in data:
        return jsonify({'error': 'Invalid trip JSON: missing name field'}), 400

    stops_data = data.get('stops', [])
    # Support old export format that had a separate 'waypoints' list
    legacy_waypoints = data.get('waypoints', [])
    all_locations_data = [l for l in stops_data + legacy_waypoints if l.get('guid')]

    # Build old_guid → new_guid mapping for every location up front
    guid_map = {loc['guid']: str(uuid_module.uuid4()) for loc in all_locations_data}

    db = get_db()
    try:
        # ── Create the trip ───────────────────────────────────────────────────
        new_trip = Trip(name=data['name'])

        start_loc = data.get('start_location') or {}
        if start_loc.get('address'):
            new_trip.start_location_address = start_loc['address']
            new_trip.start_location_latitude = start_loc.get('latitude')
            new_trip.start_location_longitude = start_loc.get('longitude')
            new_trip.start_location_guid = str(uuid_module.uuid4())

        end_loc = data.get('end_location') or {}
        if end_loc.get('address'):
            new_trip.end_location_address = end_loc['address']
            new_trip.end_location_latitude = end_loc.get('latitude')
            new_trip.end_location_longitude = end_loc.get('longitude')
            new_trip.end_location_guid = str(uuid_module.uuid4())

        db.add(new_trip)
        db.flush()  # assigns new_trip.id

        # ── Topological sort so parents are inserted before children ──────────
        loc_by_old_guid = {loc['guid']: loc for loc in all_locations_data}
        created_old_guids = set()
        ordered = []
        remaining = list(all_locations_data)

        while remaining:
            made_progress = False
            still_remaining = []
            for loc in remaining:
                prev = loc.get('previous_location_guid')
                # Ready if it has no parent, or its parent is outside this
                # import set (e.g. references a deleted stop), or already done.
                if prev is None or prev not in loc_by_old_guid or prev in created_old_guids:
                    ordered.append(loc)
                    created_old_guids.add(loc['guid'])
                    made_progress = True
                else:
                    still_remaining.append(loc)
            remaining = still_remaining
            if not made_progress:
                # Cycle or unresolvable chain — append as-is to avoid infinite loop
                ordered.extend(remaining)
                break

        # ── Insert locations ──────────────────────────────────────────────────
        old_id_to_new_stop: dict[int, Stop] = {}

        for loc in ordered:
            old_guid = loc['guid']
            new_guid = guid_map[old_guid]
            old_prev = loc.get('previous_location_guid')
            new_prev = guid_map.get(old_prev)  # None if parent not in this file

            common = dict(
                trip_id=new_trip.id,
                guid=new_guid,
                name=loc['name'],
                location_type=loc.get('location_type', 'gps'),
                latitude=loc.get('latitude'),
                longitude=loc.get('longitude'),
                address=loc.get('address'),
                description=loc.get('description', ''),
                url=loc.get('url', ''),
                previous_location_guid=new_prev,
            )

            new_stop = Stop(
                **common,
                start_date=parse_iso_date(loc['start_date']) if loc.get('start_date') else None,
                end_date=parse_iso_date(loc['end_date']) if loc.get('end_date') else None,
            )
            db.add(new_stop)
            db.flush()
            old_id_to_new_stop[loc['id']] = new_stop

        # ── Insert activities linked to new stop IDs ──────────────────────────
        for stop_data in stops_data:
            new_stop = old_id_to_new_stop.get(stop_data.get('id'))
            if not new_stop:
                continue
            for act in stop_data.get('activities', []):
                db.add(Activity(
                    stop_id=new_stop.id,
                    name=act['name'],
                    description=act.get('description', ''),
                    url=act.get('url', ''),
                ))

        db.commit()
        return jsonify({
            'message': f'Trip "{new_trip.name}" imported successfully',
            'trip_id': new_trip.id,
            'trip_name': new_trip.name,
        }), 201

    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
