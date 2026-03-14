# Database Protection Strategy - Preventing Accidental Overwrites During Deployment

## The Risk

When deploying via `git pull`, there's a risk that `database.db` could be overwritten if:
1. It was previously committed to the repository
2. Git operations restore it from history
3. Custom deployment scripts accidentally overwrite it
4. The file gets out of sync between environments

## How It's Protected

### Layer 1: Git Ignore ✓
```gitignore
database.db
```
- `database.db` is in `.gitignore`
- Git never tracks the live database
- Your data stays safe from version control

### Layer 2: Safety Checks ✓
**Script**: `ensure_directories.py --check-db-safety`

The script verifies:
- ✓ Database file exists
- ✓ Database.db is in .gitignore (not trackable)
- ✓ Available backups for recovery
- ✓ Database integrity (size and modification time)

### Layer 3: Automatic Backup Before Restore ✓
If you restore from a backup using:
```bash
python ensure_directories.py --restore-db-from-backup database_backup_2026-03-14_093100.db
```

The system automatically:
1. Creates a safety copy: `database.pre_restore_YYYYMMDD_HHMMSS.db`
2. Restores from your backup
3. You can always roll back if something goes wrong

### Layer 4: Deployment Integration ✓
Add to your deployment process:
```bash
# 1. Pull latest code
git pull origin main

# 2. Check database safety (CRITICAL!)
python ensure_directories.py --check-db-safety

# 3. If database is missing, restore from backup
python ensure_directories.py --restore-db-from-backup <filename>

# 4. Continue deployment...
```

## Deployment Commands Reference

### Standard Deployment (Safe)
```bash
# Ensures directories exist, checks database safety
python ensure_directories.py

# Output:
# ✓ Directory already exists: backups
# ✓ Directory already exists: json_dump
# ✓ Database file is protected and present
# ✅ All critical components are ready for deployment!
```

### Detailed Database Safety Check
```bash
# Verbose check with database details
python ensure_directories.py --check-db-safety

# Output includes:
# - Database file location and size
# - Last modified timestamp
# - Available backups for recovery
# - Confirmation that database.db is in .gitignore
```

### Restore from Backup (Emergency Recovery)
```bash
# Restore specific backup file
python ensure_directories.py --restore-db-from-backup database_backup_2026-03-14_093100.db

# System will:
# 1. Create safety backup: database.pre_restore_20260314_093100.db
# 2. Restore from selected backup
# 3. Confirm restoration success
```

### List Available Backups
```bash
# See what backups are available
ls -la backups/

# Or use Python:
python -c "from backup_db import list_backups; import json; print(json.dumps(list_backups(), indent=2))"
```

## Systemd Integration (Linux)

Add to your service file (`/etc/systemd/system/norway-trip-planner.service`):

```ini
[Service]
# Run database safety check before starting
ExecStartPre=/usr/bin/python3 /path/to/ensure_directories.py --check-db-safety

# Your main application
ExecStart=/usr/bin/python3 /path/to/app.py

# Restart on failure
Restart=always
RestartSec=10
```

After editing:
```bash
systemctl daemon-reload
systemctl restart norway-trip-planner
```

## Docker Integration

In your Dockerfile or entrypoint script:
```dockerfile
# After git pull in deployment
RUN python ensure_directories.py --check-db-safety

# Start application
CMD ["python", "app.py"]
```

Or in entrypoint script:
```bash
#!/bin/bash
set -e
git pull origin main
python ensure_directories.py --check-db-safety || exit 1
exec python app.py
```

## GitHub Actions Integration

Add to your workflow (`.github/workflows/deploy.yml`):
```yaml
- name: Check database safety
  run: python ensure_directories.py --check-db-safety

- name: Deploy
  run: |
    # Your deployment commands here
    systemctl restart norway-trip-planner
```

## What NOT to Do ❌

```bash
# ❌ DON'T manually edit or delete database.db
rm database.db
git checkout database.db  # This would restore from git history!

# ❌ DON'T commit database.db to git
git add database.db
git commit -m "Update database"  # NEVER do this

# ❌ DON'T use git commands to manage the database
git push  # Don't push database.db

# ❌ DON'T overwrite manually during deployment
cp old_database.db database.db  # Without backup!
```

## What TO Do ✓

```bash
# ✓ DO use backups for recovery
python backup_db.py --backup-dir backups --max-backups 7

# ✓ DO check safety before deployment
python ensure_directories.py --check-db-safety

# ✓ DO use the restore function with backups
python ensure_directories.py --restore-db-from-backup database_backup_2026-03-14_093100.db

# ✓ DO keep database.db in .gitignore
echo "database.db" >> .gitignore

# ✓ DO download backups regularly to your laptop
# Use the /backups page to download via browser
```

## File Structure Protection Summary

| File/Directory | Git Status | Git Ignore | Protected? | How |
|---|---|---|---|---|
| `database.db` | Not tracked | ✓ Yes | ✓ Yes | In .gitignore + safety checks |
| `backups/` | Directory tracked (via .gitkeep) | ✓ Yes | ✓ Yes | .gitkeep anchor + ensure_directories |
| `json_dump/` | Directory tracked (via .gitkeep) | ✓ Yes | ✓ Yes | .gitkeep anchor + ensure_directories |
| `backup_*.db` | Not tracked | ✓ Yes | ✓ Yes | In backups/ + .gitignore |

## Troubleshooting

### Q: Database is missing after deployment!
```bash
# 1. Check available backups
python ensure_directories.py --check-db-safety

# 2. Restore from backup
python ensure_directories.py --restore-db-from-backup <filename>

# 3. Verify
python ensure_directories.py --check-db-safety
```

### Q: I see "database.db is NOT in .gitignore" warning
```bash
# 1. Check .gitignore
cat .gitignore | grep database.db

# 2. If missing, add it
echo "database.db" >> .gitignore

# 3. Remove from git tracking
git rm --cached database.db
git commit -m "Stop tracking database.db"
```

### Q: How do I know if my database is safe?
```bash
# Run this - it will tell you everything
python ensure_directories.py --check-db-safety
```

### Q: Can I use a different database location?
Yes! Edit `backup_db.py`:
```python
# Use environment variable for flexibility
import os
DEFAULT_DB_PATH = Path(os.getenv('DB_PATH', str(PROJECT_ROOT / 'database.db')))
```

Then deploy with:
```bash
export DB_PATH=/var/lib/norway-trip-planner/database.db
python ensure_directories.py --check-db-safety
```

## Verification Checklist

Before each deployment, verify:
- [ ] `database.db` is in `.gitignore`
- [ ] Running `python ensure_directories.py` shows database is protected
- [ ] Recent backups exist in `backups/` directory
- [ ] You have a copy of backups downloaded to your laptop
- [ ] `.gitkeep` files exist in critical directories
- [ ] Deployment script includes `ensure_directories.py` check

## Emergency Recovery Procedure

If database is corrupted or lost:

1. **Assess the damage**
   ```bash
   python ensure_directories.py --check-db-safety
   ```

2. **Find the best backup**
   ```bash
   ls -lah backups/database_backup_*.db
   ```

3. **Create safety backup of current state** (if exists)
   ```bash
   cp database.db database.db.broken
   ```

4. **Restore from backup**
   ```bash
   python ensure_directories.py --restore-db-from-backup database_backup_2026-03-14_093100.db
   ```

5. **Verify restoration**
   ```bash
   python ensure_directories.py --check-db-safety
   python app.py  # Test the app
   ```

6. **Update your laptop backups**
   ```bash
   # Download the newly restored database from /backups page
   ```

## Key Takeaway

✅ **Your database.db is now protected from:**
- Git pull overwrites
- Accidental deletions
- Out-of-sync issues
- Unintended restoration from git history

✅ **Always run this after deployment:**
```bash
python ensure_directories.py --check-db-safety
```

This takes 1 second and prevents data loss disasters!
