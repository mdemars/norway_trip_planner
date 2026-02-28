"""
SQLite database backup and restore utilities.

Can be run directly:
    python backup_db.py [--backup-dir backups] [--max-backups 7]

Or imported by app.py for API endpoints.
"""
import argparse
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
DEFAULT_DB_PATH = PROJECT_ROOT / "database.db"
DEFAULT_BACKUP_DIR = PROJECT_ROOT / "backups"
DEFAULT_MAX_BACKUPS = 7
BACKUP_FILENAME_PATTERN = "database_backup_{timestamp}.db"  # {timestamp} = yyyy-MM-dd_HHmmss


def _timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d_%H%M%S")


def create_backup(
    db_path: Path = DEFAULT_DB_PATH,
    backup_dir: Path = DEFAULT_BACKUP_DIR,
    filename_pattern: str = BACKUP_FILENAME_PATTERN,
    max_backups: int = DEFAULT_MAX_BACKUPS,
) -> Path:
    """
    Copy db_path to backup_dir using SQLite's online backup API.
    Prunes oldest files if count exceeds max_backups.
    Returns the path of the new backup file.
    Raises FileNotFoundError if db_path doesn't exist.
    """
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    backup_dir = Path(backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)

    dest_name = filename_pattern.format(timestamp=_timestamp())
    dest = backup_dir / dest_name

    # SQLite online backup API — safe even when the app is writing
    src_conn = sqlite3.connect(db_path)
    dst_conn = sqlite3.connect(dest)
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()

    # Prune old backups — keep newest max_backups
    if max_backups > 0:
        existing = sorted(backup_dir.glob("database_backup_*.db"))
        for old in existing[:-max_backups]:
            old.unlink()

    return dest


def restore_backup(backup_path: Path, db_path: Path = DEFAULT_DB_PATH) -> None:
    """
    Overwrite db_path with the backup at backup_path.
    Creates a safety snapshot of the current DB before overwriting.
    Raises FileNotFoundError if backup_path doesn't exist.
    """
    backup_path = Path(backup_path)
    if not backup_path.exists():
        raise FileNotFoundError(f"Backup file not found: {backup_path}")

    # Safety: snapshot current DB before overwriting
    if db_path.exists():
        safety = db_path.with_suffix(f".pre_restore_{_timestamp()}.db")
        shutil.copy2(db_path, safety)

    # Use SQLite backup API for a clean copy
    src_conn = sqlite3.connect(backup_path)
    dst_conn = sqlite3.connect(db_path)
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()


def list_backups(backup_dir: Path = DEFAULT_BACKUP_DIR) -> list:
    """
    Return list of backup file info dicts sorted newest-first.
    Each dict: { filename, path, size_bytes, created_at }
    """
    backup_dir = Path(backup_dir)
    if not backup_dir.exists():
        return []

    result = []
    for f in sorted(backup_dir.glob("database_backup_*.db"), reverse=True):
        stat = f.stat()
        result.append({
            "filename": f.name,
            "path": str(f),
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backup the Norway Trip Planner SQLite database")
    parser.add_argument("--backup-dir", default=str(DEFAULT_BACKUP_DIR))
    parser.add_argument("--max-backups", type=int, default=DEFAULT_MAX_BACKUPS)
    args = parser.parse_args()

    dest = create_backup(
        backup_dir=Path(args.backup_dir),
        max_backups=args.max_backups,
    )
    print(f"Backup created: {dest}")
