from flask import Blueprint, request, jsonify
from pathlib import Path
from backup_db import create_backup, restore_backup, list_backups, DEFAULT_BACKUP_DIR, DEFAULT_DB_PATH

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
