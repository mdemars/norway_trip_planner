# Quick Start Guide

## Setup (5 minutes)

### Linux/Mac
```bash
chmod +x setup.sh
./setup.sh
```

### Windows
```
setup.bat
```

## Configure Google Maps API

1. Get a free API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable these APIs:
   - Directions API
   - Geocoding API
3. Edit `.env` and add your API key:
   ```
   GOOGLE_MAPS_API_KEY=your_key_here
   ```

## Run the Application

### Linux/Mac
```bash
chmod +x run.sh
./run.sh
```

### Windows
```
run.bat
```

Open browser to: **http://localhost:5000**

## First Steps

1. **Create a Trip**: Click "Create New Trip"
2. **Add Stops**: Click "Add Stop" and enter location details
3. **Add Activities**: For each stop, add things to do
4. **View Map**: See your route and distances automatically

## Tips

- Use addresses (e.g., "Oslo, Norway") or GPS coordinates
- Drag stops to reorder them
- The app automatically calculates distances
- All data is stored locally on your computer

## Need Help?

See [README.md](README.md) for detailed documentation.
