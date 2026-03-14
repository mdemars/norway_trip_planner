# Deployment Strategy - Protecting Backups and Critical Directories

## Problem Solved

When you do a `git pull` deployment, git-ignored directories that don't have any tracked files can appear to be deleted if:
- They were previously committed to the repository
- The directory became empty and wasn't re-created on the new deployment

This guide ensures your backups survive all deployment scenarios.

## Solution: Multi-Layer Protection

### 1. **`.gitkeep` Placeholder** ✓ Already in place
   - File: `backups/.gitkeep`
   - Purpose: Ensures the directory is tracked by git, so it always exists after clone/pull
   - Benefit: Directory survives all git operations, even if empty

### 2. **`.gitignore` Configuration** ✓ Already configured
   - Backups folder is ignored: `backups/`
   - Your actual backup files are never committed
   - But the empty directory structure is preserved via `.gitkeep`

### 3. **Deployment Initialization** ← Use this
   - Script: `ensure_directories.py`
   - Run after every `git pull` deployment
   - Creates any missing directories automatically

## Deployment Steps (Recommended)

### For Manual Deployments:
```bash
# 1. Pull latest code
git pull origin main

# 2. Ensure directories exist
python ensure_directories.py

# 3. Install/update dependencies
pip install -r requirements.txt

# 4. Restart your application (Flask, systemd, Docker, etc.)
```

### For Systemd Service:
Add to your service file (`/etc/systemd/system/norway-trip-planner.service`):
```ini
[Unit]
Description=Norway Trip Planner
After=network.target

[Service]
Type=notify
User=www-data
WorkingDirectory=/path/to/norway_trip_planner
ExecStartPre=/usr/bin/python3 /path/to/norway_trip_planner/ensure_directories.py
ExecStart=/usr/bin/python3 /path/to/norway_trip_planner/app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

### For Docker:
Add to your `Dockerfile` or entrypoint script:
```dockerfile
# After git pull in your deployment script
RUN python ensure_directories.py
CMD ["python", "app.py"]
```

### For GitHub Actions / CI/CD:
```yaml
- name: Deploy
  run: |
    git pull origin main
    python ensure_directories.py
    pip install -r requirements.txt
    # your start command
```

## Directory Structure Protection

| Directory | Tracked? | Ignored? | Protection |
|-----------|----------|----------|------------|
| `backups/` | No | Yes | `.gitkeep` + `ensure_directories.py` |
| `json_dump/` | No | Yes | `.gitkeep` + `ensure_directories.py` |
| `database.db` | No | Yes | File ignored (recreate if needed) |
| `venv/` | No | Yes | Created by `setup.bat/sh` |

## Recovery Procedure (If Backups Were Lost)

If your backups folder was already deleted:

1. **Check if you have off-site backups** (downloaded to your laptop):
   ```bash
   # You should have files like: database_backup_2026-03-14_120000.db
   ```

2. **Restore using the upload feature**:
   - Go to `/backups` page
   - Click "Upload Backup"
   - Select your local backup file
   - Check "Restore immediately after upload"

3. **Future-proof your setup**:
   - Download backups regularly to your laptop using the Download button
   - Or set up automatic off-site backup sync

## Best Practices

1. **Always run `ensure_directories.py` after deployments**
2. **Regularly download backups to your local machine** (your laptop)
3. **Set up automated off-site backup sync** (e.g., daily cron job)
4. **Document your backup rotation policy** (how many to keep)
5. **Test restore procedures** regularly

## Verification

To verify your setup is protected:

```bash
# Check .gitkeep exists
ls -la backups/
# Should see: .gitkeep

# Check .gitignore is configured
grep "^backups/" .gitignore
# Should return: backups/

# Test ensure_directories script
python ensure_directories.py
# Should confirm directories are ready
```

## Configuration

Currently, backups are kept in the `backups/` directory relative to the project root.
To use a different location, edit `backup_db.py`:

```python
# Example: Use an absolute path for better deployment safety
DEFAULT_BACKUP_DIR = Path("/var/lib/norway-trip-planner/backups")
```

Or use environment variables in `config.py`:
```python
BACKUP_DIR = os.getenv('BACKUP_DIR', str(Path(__file__).parent / 'backups'))
```

## Questions?

- **Why `.gitkeep`?** It's a convention - any file works, but `.gitkeep` indicates "this directory should exist"
- **Why ignore backups in git?** Because backup files can be large and shouldn't clutter your repository history
- **What if I want to commit backups?** Use git-LFS or store them externally (S3, backup service, etc.)
- **Can I use different backup locations?** Yes, use `BACKUP_DIR` environment variable or modify `backup_db.py`
