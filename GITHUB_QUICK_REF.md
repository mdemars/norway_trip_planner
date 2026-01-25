# GitHub Quick Reference

## Quick Setup (Choose One Method)

### Method 1: Command Line (3 steps)
```bash
# 1. Initialize and commit
git init
git add .
git commit -m "Initial commit"

# 2. Create repo on GitHub, then run (replace YOUR_USERNAME/YOUR_REPO):
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Method 2: GitHub Desktop (Easiest)
1. Install GitHub Desktop
2. File → Add Local Repository → Select "Norway Trip" folder
3. Create repository if prompted
4. Click "Publish repository"
5. Done! ✅

---

## Daily Git Commands

```bash
# Check what changed
git status

# Add and commit changes
git add .
git commit -m "Description of what you changed"

# Push to GitHub
git push

# Pull latest changes
git pull
```

---

## Important Files Already Configured

✅ `.gitignore` - Protects your API keys and sensitive data  
✅ `.gitattributes` - Proper line endings for all files  
✅ `LICENSE` - MIT license for your project  
✅ Issue templates - For bug reports and feature requests  
✅ PR template - For pull requests  
✅ GitHub Actions - Automated testing workflow  
✅ Contributing guide - For collaborators  

---

## Your .env is Safe! 🔒

The `.gitignore` file prevents these from being uploaded:
- `.env` (your API keys)
- `venv/` (Python virtual environment)
- `*.db` (database files)
- `__pycache__/` (Python cache)

**Never commit your API keys!**

---

## Repository Settings Checklist

After creating your GitHub repository:

### General Settings
- [ ] Add description: "Trip planning app with stops, activities, and route calculation"
- [ ] Add topics: `python`, `flask`, `trip-planner`, `google-maps`, `sqlite`
- [ ] Add website URL (if you deploy it)

### Collaborators (if working with others)
- [ ] Settings → Collaborators → Add people

### Branch Protection (recommended)
- [ ] Settings → Branches → Add rule for `main`
- [ ] Require pull request reviews
- [ ] Require status checks to pass

### Secrets (for GitHub Actions)
- [ ] Settings → Secrets and variables → Actions
- [ ] Add `GOOGLE_MAPS_API_KEY` if needed for CI/CD

---

## Common Scenarios

### Working with someone else
```bash
# They clone your repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# They make changes
git checkout -b feature-name
# ... make changes ...
git add .
git commit -m "Add new feature"
git push origin feature-name

# Then they create a Pull Request on GitHub
```

### Updating your local copy
```bash
# Get latest changes from GitHub
git pull origin main
```

### Fix a mistake
```bash
# Undo last commit (keeps changes)
git reset --soft HEAD~1

# Discard all local changes (dangerous!)
git reset --hard HEAD
```

---

## GitHub Features to Use

### 📋 Issues
- Track bugs and features
- Use labels: `bug`, `enhancement`, `documentation`
- Reference in commits: `git commit -m "Fix #42: Route calculation bug"`

### 🔀 Pull Requests
- Code review before merging
- Automatic tests run via GitHub Actions
- Discussion and collaboration

### 📊 Projects
- Kanban board for task management
- Go to "Projects" tab → "New project"

### 🚀 Releases
- Create version releases
- Go to "Releases" → "Create new release"
- Use semantic versioning: v1.0.0, v1.1.0, etc.

### 📖 Wiki
- Extended documentation
- Go to "Wiki" tab

---

## Getting Help

- **Git confused?** Run `git status` to see where you are
- **Merge conflicts?** GitHub Desktop shows them visually
- **Need to undo?** See the "Fix a mistake" section above
- **Questions?** Open an issue with the `question` label

---

## Next Steps

1. ✅ Push code to GitHub (you're doing this now!)
2. 🎨 Add frontend (HTML/CSS/JS)
3. 🧪 Write tests
4. 📝 Update README with screenshots
5. 🚀 Deploy to a server (optional)
6. 🌟 Star your own repo!

---

## Resources

- [GitHub Docs](https://docs.github.com)
- [Git Handbook](https://guides.github.com/introduction/git-handbook/)
- [GitHub Desktop Docs](https://docs.github.com/en/desktop)
- Full guide: See `GITHUB_SETUP.md`
