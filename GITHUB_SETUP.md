# Connecting Norway Trip to GitHub

## Prerequisites

1. A GitHub account (create one at https://github.com)
2. Git installed on your computer
   - Windows: Download from https://git-scm.com/download/win
   - Mac: `brew install git` or download from https://git-scm.com/download/mac
   - Linux: `sudo apt-get install git` or `sudo yum install git`

## Step-by-Step Instructions

### Option 1: Create Repository on GitHub First (Recommended)

#### 1. Create a New Repository on GitHub

1. Go to https://github.com
2. Click the "+" icon in the top right
3. Select "New repository"
4. Fill in the details:
   - **Repository name**: `norway-trip-planner` (or your preferred name)
   - **Description**: "A Python Flask app for planning trips with stops, activities, and route calculation"
   - **Visibility**: Choose Public or Private
   - **DO NOT** check "Initialize this repository with a README" (we already have one)
5. Click "Create repository"

#### 2. Connect Your Local Project

Open a terminal/command prompt in your "Norway Trip" folder and run:

```bash
# Initialize git repository
git init

# Add all files to git
git add .

# Create your first commit
git commit -m "Initial commit: Complete trip planner backend"

# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/norway-trip-planner.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Option 2: Use GitHub Desktop (Easier for Beginners)

#### 1. Install GitHub Desktop

Download from: https://desktop.github.com/

#### 2. Add Your Project

1. Open GitHub Desktop
2. Click "File" → "Add Local Repository"
3. Click "Choose..." and select your "Norway Trip" folder
4. If prompted that it's not a Git repository, click "Create a repository"
5. Fill in the details and click "Create Repository"

#### 3. Publish to GitHub

1. Click "Publish repository" in the top bar
2. Choose a name and description
3. Choose Public or Private
4. Click "Publish Repository"

## Important: Environment Variables

**CRITICAL**: Your `.env` file is already in `.gitignore`, so your API keys will NOT be uploaded to GitHub. This is for security.

### For Collaborators or Future Setup

When you or someone else clones the repository, they'll need to:

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Add their own Google Maps API key to `.env`

## After Connecting to GitHub

### Make Changes and Update

```bash
# Check status of changes
git status

# Add changed files
git add .

# Commit changes
git commit -m "Description of what you changed"

# Push to GitHub
git push
```

### Clone on Another Computer

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/norway-trip-planner.git

# Navigate to the folder
cd norway-trip-planner

# Run setup
./setup.sh  # or setup.bat on Windows

# Create .env file and add your API key
cp .env.example .env
# Edit .env with your API key
```

## Common Git Commands

```bash
# See what's changed
git status

# See commit history
git log

# Pull latest changes from GitHub
git pull

# Create a new branch
git checkout -b feature-name

# Switch branches
git checkout main

# Merge a branch
git merge feature-name
```

## Recommended Repository Description

```
🗺️ Norway Trip Planner

A locally hosted Python Flask application for planning trips with multiple stops, activities, and route visualization using Google Maps API.

Features:
✨ Trip management with multiple stops
📍 GPS coordinates or address input
🗓️ Date tracking for each stop
📝 Activity lists with descriptions and URLs
🗺️ Interactive route visualization
📏 Automatic distance calculations

Tech Stack: Python, Flask, SQLAlchemy, Google Maps API, Geopy
```

## Best Practices

1. **Never commit `.env` files** (already protected by `.gitignore`)
2. **Write clear commit messages** describing what changed
3. **Commit often** - small, focused commits are better
4. **Use branches** for new features
5. **Keep README.md updated** as you add features

## Adding a License

Consider adding a license file. Common choices:

- **MIT License** (most permissive)
- **Apache 2.0** (similar to MIT with patent protection)
- **GPL** (requires derivatives to be open source)

To add a license on GitHub:
1. Go to your repository
2. Click "Add file" → "Create new file"
3. Name it `LICENSE`
4. GitHub will offer license templates - choose one

## Optional: Add a .github Folder

Create `.github/workflows/` for GitHub Actions (CI/CD), or `.github/ISSUE_TEMPLATE/` for issue templates.

## Troubleshooting

### "Permission denied" when pushing

Set up SSH keys or use a personal access token:
https://docs.github.com/en/authentication

### "Repository not found"

Check that the remote URL is correct:
```bash
git remote -v
```

To update it:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/norway-trip-planner.git
```

### Files show as changed but shouldn't be

Check your `.gitignore` file includes:
- `venv/`
- `*.db`
- `.env`
- `__pycache__/`

## Next Steps After GitHub Setup

1. Add a LICENSE file
2. Create a `.github/workflows/` folder for CI/CD
3. Add badges to README.md (build status, license, etc.)
4. Enable GitHub Pages if you want to host documentation
5. Set up GitHub Issues for tracking features/bugs

## Resources

- GitHub Docs: https://docs.github.com
- Git Documentation: https://git-scm.com/doc
- GitHub Desktop: https://desktop.github.com
- Git Cheat Sheet: https://education.github.com/git-cheat-sheet-education.pdf
