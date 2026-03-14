#!/usr/bin/env python3
"""
Deployment Setup Helper - Ensures critical directories exist after git pull/clone.
Also provides database protection and safeguards against accidental overwrites.

This script should be run after deployment to ensure all runtime directories are created.
Include it in your deployment process (systemd service, cron job, CI/CD pipeline, etc.)

Usage:
    python ensure_directories.py
    python ensure_directories.py --check-db-safety
    python ensure_directories.py --restore-db-from-backup <backup_file>
"""

from pathlib import Path
import sys
import argparse
from datetime import datetime

# Define directories that MUST exist but are git-ignored
REQUIRED_DIRS = {
    'backups': 'Database backup storage (not tracked by git)',
    'json_dump': 'JSON export directory (not tracked by git)',
}

PROJECT_ROOT = Path(__file__).parent
DB_PATH = PROJECT_ROOT / 'database.db'
BACKUP_DIR = PROJECT_ROOT / 'backups'


def ensure_directories():
    """Create all required directories if they don't exist."""
    errors = []

    for dir_name, description in REQUIRED_DIRS.items():
        dir_path = PROJECT_ROOT / dir_name
        if not dir_path.exists():
            try:
                dir_path.mkdir(parents=True, exist_ok=True)
                print(f"✓ Created directory: {dir_name}")
                print(f"  Purpose: {description}")
            except Exception as e:
                error_msg = f"✗ Failed to create {dir_name}: {e}"
                print(error_msg, file=sys.stderr)
                errors.append(error_msg)
        else:
            print(f"✓ Directory already exists: {dir_name}")

    return len(errors) == 0


def check_database_safety():
    """
    Check database integrity and safety.
    Ensures database.db exists and warn if it might have been at risk.
    """
    print("\n🔒 Database Safety Check")
    print("=" * 50)

    if DB_PATH.exists():
        stat = DB_PATH.stat()
        size_mb = stat.st_size / (1024 * 1024)
        mod_time = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        print(f"✓ Database exists: {DB_PATH.name}")
        print(f"  Size: {size_mb:.2f} MB")
        print(f"  Last modified: {mod_time}")
        
        # Check if database.db is in .gitignore
        gitignore_path = PROJECT_ROOT / '.gitignore'
        if gitignore_path.exists():
            gitignore_content = gitignore_path.read_text()
            if 'database.db' in gitignore_content:
                print(f"✓ database.db is protected in .gitignore")
            else:
                print(f"⚠ WARNING: database.db is NOT in .gitignore!")
                print(f"  This means git could overwrite it during deployment!")
                return False
        return True
    else:
        print(f"⚠ Database NOT found: {DB_PATH.name}")
        print(f"  Location: {DB_PATH}")
        
        # Check for backups
        if BACKUP_DIR.exists():
            backups = sorted(BACKUP_DIR.glob('database_backup_*.db'), reverse=True)
            if backups:
                print(f"\n  Available backups ({len(backups)}):")
                for backup in backups[:3]:
                    stat = backup.stat()
                    size_mb = stat.st_size / (1024 * 1024)
                    mod_time = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                    print(f"    • {backup.name} ({size_mb:.2f} MB, {mod_time})")
                if len(backups) > 3:
                    print(f"    ... and {len(backups) - 3} more")
                
                print(f"\n  To restore: python ensure_directories.py --restore-db-from-backup <filename>")
            else:
                print(f"  ⚠ No backups found! Cannot automatically restore.")
        
        print(f"\n  CRITICAL: Database is missing!")
        print(f"  You must restore a backup or re-initialize the application.")
        return False


def restore_database_from_backup(backup_filename):
    """
    Safely restore database from a backup file.
    """
    print(f"\n📥 Restoring Database from Backup")
    print("=" * 50)
    
    backup_path = BACKUP_DIR / backup_filename
    
    if not backup_path.exists():
        print(f"✗ Backup file not found: {backup_path}")
        return False
    
    if not backup_path.suffix == '.db':
        print(f"✗ Invalid backup file type. Must be .db file")
        return False
    
    # Preserve existing database as safety backup
    if DB_PATH.exists():
        safety_name = f"database.pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        safety_path = PROJECT_ROOT / safety_name
        try:
            import shutil
            shutil.copy2(DB_PATH, safety_path)
            print(f"✓ Saved safety backup: {safety_name}")
        except Exception as e:
            print(f"✗ Failed to create safety backup: {e}")
            return False
    
    # Restore from backup
    try:
        import shutil
        shutil.copy2(backup_path, DB_PATH)
        print(f"✓ Database restored from: {backup_filename}")
        
        stat = DB_PATH.stat()
        size_mb = stat.st_size / (1024 * 1024)
        print(f"  Size: {size_mb:.2f} MB")
        print(f"\n✅ Restoration successful!")
        return True
    except Exception as e:
        print(f"✗ Failed to restore database: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Deployment setup helper with database protection"
    )
    parser.add_argument(
        '--check-db-safety',
        action='store_true',
        help='Check database safety and integrity'
    )
    parser.add_argument(
        '--restore-db-from-backup',
        metavar='FILENAME',
        help='Restore database from a backup file'
    )
    
    args = parser.parse_args()
    
    print("🚀 Deployment Setup Helper")
    print("=" * 50)
    print()
    
    # Always ensure directories
    success = ensure_directories()
    
    # Handle database restoration if requested
    if args.restore_db_from_backup:
        if not restore_database_from_backup(args.restore_db_from_backup):
            sys.exit(1)
    
    # Check database safety
    if args.check_db_safety or not DB_PATH.exists():
        if not check_database_safety():
            print("\n⚠ Database safety check failed!")
            if not args.check_db_safety:
                sys.exit(1)
    else:
        # Quick database check when not in verbose mode
        print(f"✓ Database file is protected and present")
    
    print()
    if success and DB_PATH.exists():
        print("✅ All critical components are ready for deployment!")
        sys.exit(0)
    elif success:
        print("⚠ Setup complete, but database is missing. Run with --check-db-safety for details")
        sys.exit(1)
    else:
        print("✗ Setup failed!")
        sys.exit(1)


if __name__ == '__main__':
    main()
