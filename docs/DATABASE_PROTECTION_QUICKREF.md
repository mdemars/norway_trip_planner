# Database Protection - Quick Reference

## 🚀 Post-Deployment Checklist (After `git pull`)

```bash
# ALWAYS run this after deployment
python ensure_directories.py --check-db-safety

# Should show:
# ✓ Database exists: database.db
# ✓ database.db is protected in .gitignore
# ✅ All critical components are ready!
```

## 🔒 What's Protected

✅ `database.db` - Never overwritten by git
✅ `backups/` - Backups survive all deployments
✅ `json_dump/` - Exports directory is safe

## 📋 Common Commands

| Task | Command |
|------|---------|
| **Check database safety** | `python ensure_directories.py --check-db-safety` |
| **Create backup** | `python backup_db.py` |
| **List backups** | `ls -la backups/` |
| **Restore backup** | `python ensure_directories.py --restore-db-from-backup <file>` |
| **Download backup** | Go to `/backups` page → click Download button |
| **Upload & restore** | Go to `/backups` page → click Upload Backup |

## ⚠️ Critical Rules

| ✅ DO | ❌ DON'T |
|------|---------|
| Use `.gitignore` | Commit `database.db` to git |
| Backup regularly | Delete `database.db` manually |
| Use upload/download | Use `git checkout database.db` |
| Run safety check | Restore without safety backup |
| Keep `.gitkeep` files | Remove `.gitkeep` files |

## 🆘 If Database Goes Missing

```bash
# 1. Check what happened
python ensure_directories.py --check-db-safety

# 2. Restore from backup (auto-creates safety copy)
python ensure_directories.py --restore-db-from-backup database_backup_2026-03-14_093100.db

# 3. Verify it's back
python ensure_directories.py --check-db-safety
```

## 📂 File Structure

```
project/
├── database.db                 ← Live database (git-ignored)
├── .gitignore                  ← Includes "database.db"
├── backups/
│   ├── .gitkeep               ← Directory anchor
│   ├── database_backup_*.db   ← Your backups
│   └── database_backup_*.db
├── ensure_directories.py      ← Run after git pull
├── backup_db.py               ← Create/restore backups
├── DATABASE_PROTECTION.md     ← Full guide
└── DEPLOYMENT.md              ← Deployment guide
```

## 🔧 Deployment Integration

Add to your deployment script:
```bash
#!/bin/bash
git pull origin main
python ensure_directories.py --check-db-safety  # ← CRITICAL
pip install -r requirements.txt
systemctl restart norway-trip-planner
```

## 📞 Need Help?

- **Full guide**: See `DATABASE_PROTECTION.md`
- **Deployment guide**: See `DEPLOYMENT.md`
- **Backup management**: See `backup_db.py --help`

---

**Remember**: One command prevents data loss disasters!
```bash
python ensure_directories.py --check-db-safety
```

