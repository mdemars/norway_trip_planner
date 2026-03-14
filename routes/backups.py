from flask import Blueprint, request, jsonify, send_file
from pathlib import Path
from backup_db import create_backup, restore_backup, list_backups, DEFAULT_BACKUP_DIR, DEFAULT_DB_PATH
import os
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
