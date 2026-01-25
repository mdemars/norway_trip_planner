# Contributing to Norway Trip Planner

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/norway-trip-planner.git
   cd norway-trip-planner
   ```
3. Run setup:
   ```bash
   ./setup.sh  # or setup.bat on Windows
   ```
4. Create a `.env` file with your Google Maps API key

## Development Workflow

### 1. Create a Branch
```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 2. Make Your Changes
- Write clean, documented code
- Follow existing code style
- Test your changes locally

### 3. Commit Your Changes
```bash
git add .
git commit -m "Brief description of changes"
```

**Commit Message Guidelines:**
- Use present tense: "Add feature" not "Added feature"
- Be descriptive but concise
- Reference issues: "Fix #123: Resolve route calculation bug"

### 4. Push and Create Pull Request
```bash
git push origin feature/your-feature-name
```
Then go to GitHub and create a Pull Request.

## Code Style

### Python
- Follow PEP 8 style guide
- Use meaningful variable names
- Add docstrings to functions
- Keep functions small and focused

Example:
```python
def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate distance between two GPS coordinates.
    
    Args:
        lat1: Latitude of first point
        lng1: Longitude of first point
        lat2: Latitude of second point
        lng2: Longitude of second point
    
    Returns:
        Distance in kilometers
    """
    # Implementation here
```

### JavaScript (when adding frontend)
- Use ES6+ syntax
- Add comments for complex logic
- Use `const` and `let`, avoid `var`

## Testing

Before submitting a PR:

1. Test all functionality manually
2. Ensure no errors in console
3. Test on multiple browsers (if frontend changes)
4. Verify database migrations work

## Pull Request Guidelines

### Before Submitting
- [ ] Code runs without errors
- [ ] Tested locally
- [ ] No sensitive data (API keys, passwords) in code
- [ ] Updated documentation if needed
- [ ] Followed code style guidelines

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring

## Testing
How did you test these changes?

## Screenshots (if applicable)
Add screenshots for UI changes
```

## Areas for Contribution

### High Priority
- [ ] Frontend templates (HTML/CSS/JS)
- [ ] Interactive map with Leaflet.js
- [ ] Drag-and-drop stop reordering
- [ ] Export trip to PDF/JSON
- [ ] User authentication

### Medium Priority
- [ ] Unit tests
- [ ] Integration tests
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Docker support
- [ ] Mobile responsive design

### Nice to Have
- [ ] Photo uploads for stops
- [ ] Weather integration
- [ ] Budget tracking
- [ ] Collaborative trip planning
- [ ] Offline mode (PWA)

## Project Structure

```
Norway Trip/
├── app.py              # Main Flask application
├── models.py           # Database models
├── services.py         # External services (Google Maps, geocoding)
├── config.py           # Configuration
├── static/             # CSS, JS, images
│   ├── css/
│   └── js/
├── templates/          # HTML templates
└── tests/              # Test files (to be added)
```

## Running Tests

When tests are added, run them with:
```bash
pytest tests/
```

## Documentation

- Update README.md for major changes
- Add inline comments for complex code
- Update API documentation for new endpoints

## Questions?

- Open an issue with the "question" label
- Check existing issues and discussions
- Review the README.md and documentation

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
